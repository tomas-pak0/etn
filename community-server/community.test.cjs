const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),ts=require('typescript');
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/'+fs.readdirSync('drizzle').find(f=>f.endsWith('.sql')),'utf8'));
const statement=text=>({args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(text).get(...this.args)||null;},async all(){return{results:sql.prepare(text).all(...this.args)};},async run(){const result=sql.prepare(text).run(...this.args);return{meta:{changes:Number(result.changes)}};}});
const DB={prepare:statement,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let identity=null;const users=new Map(),deleted=new Set();
const authEnv={DB,SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'test-server-key'};
const fetchAuth=async(url,options={})=>{
 if(url.endsWith('/settings'))return Response.json({external:{google:true,facebook:true,email:true},mailer_autoconfirm:false});
 if(url.includes('/admin/users/')){assert.equal(options.headers.apikey,'test-server-key');deleted.add(url.split('/').at(-1));return Response.json({});}
 const token=options.headers.Authorization?.slice(7),user=users.get(token);
 return user&&!deleted.has(user.id)?Response.json(user):Response.json({error:'invalid'}, {status:401});
};
const authContext={exports:{},require:()=>({env:authEnv}),fetch:fetchAuth,AbortSignal,atob,Date,Error,Response};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/explorer-auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,authContext);
const context={exports:{},require:name=>name==='cloudflare:workers'?{env:{DB}}:authContext.exports,crypto:globalThis.crypto,Request,Response,URL,TextEncoder,Uint8Array,Uint32Array,Date,Set,Error,console};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/community.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {api,digest}=context.exports,origin='https://test.example';
async function call(path,method='GET',body,token,otherOrigin=origin){const headers={'Origin':otherOrigin,'cf-connecting-ip':identity?.userId||'visitor'};if(token)headers.Authorization='Bearer '+token;else if(identity){const key='web-'+identity.userId;users.set(key,{id:identity.userId,email:identity.email,email_confirmed_at:identity.unverified?null:'2026-10-16T01:00:00Z'});headers.Authorization='Bearer '+key;}if(body!==undefined)headers['Content-Type']='application/json';const response=await api(new Request(origin+'/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),path.split('?')[0]);return{status:response.status,headers:response.headers,data:await response.json()};}
(async()=>{
 const accounts=[];
 authEnv.SUPABASE_AUTH_READY='false';
 const pending=await call('auth/config');assert.equal(pending.data.enabled,false);assert.equal(pending.data.publishableKey,'','pending provider configuration stays inactive');
 delete authEnv.SUPABASE_AUTH_READY;
 const config=await call('auth/config');assert.equal(config.data.providers.google,true);assert.equal(config.data.providers.facebook,true);assert.equal(config.data.providers.email,true);
 identity={userId:'00000000-0000-4000-8000-999999999999',email:'unverified@example.com',unverified:true};
 assert.equal((await call('profile','POST',{nickname:'Unverified',homeCountry:'LT',consent:true})).status,403,'an unverified email cannot create a profile');
 identity=null;
 assert.equal((await call('profile','GET',undefined,'forged-user')).status,401,'a forged browser token cannot establish identity');

 assert.equal((await call('sync','POST',{countries:[]})).status,401,'anonymous score writes are blocked');
 assert.equal((await call('profile','POST',{nickname:'bad',homeCountry:'LT',consent:true})).status,401);
 for(let i=0;i<12;i++){
  identity={userId:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),email:'private-'+i+'@example.com'};
  assert.equal((await call('profile','POST',{nickname:'Explorer '+i,homeCountry:i===11?'LT':'PL',consent:true})).status,200);
  const token=i.toString(16).padStart(64,'0'),start=await call('device/start','POST',{verifierHash:await digest(token)});
  assert.equal(start.status,200);const id=start.data.requestId;
  assert.equal((await call('device/poll','POST',{requestId:id,verifier:'f'.repeat(64)})).status,403,'a browser link cannot expose a mobile token');
  assert.equal((await call('device/poll','POST',{requestId:id,verifier:token})).data.status,'pending');
  assert.equal((await call('device/approve','POST',{requestId:id,consent:true})).status,200);
  assert.equal((await call('device/poll','POST',{requestId:id,verifier:token})).data.status,'approved');
  assert.equal((await call('sync','POST',{countries:[{code:'PL',percent:12-i},{code:'LT',percent:i+1}]},token)).status,200);
  accounts.push(token);
 }
 identity=null;
 const board=await call('leaderboard?country=PL','GET',undefined,accounts[11]);
 assert.equal(board.data.top.length,10);assert.equal(board.data.self.position,12,'the extra row uses the real position among all users');
 assert.equal(board.data.self.homeCountry,'LT','home flag is independent of the ranking country');
 assert.equal(board.data.self.percent,1);assert.equal(board.data.total,12);
 assert.ok(!JSON.stringify(board.data).includes('@example.com'),'email is not exposed');
 assert.equal((await call('leaderboard?country=LT','GET',undefined,accounts[11])).data.self.position,1,'rank is calculated separately by country');
 await call('sync','POST',{countries:[{code:'PL',percent:.1}]},accounts[11]);
 assert.equal((await call('leaderboard?country=PL','GET',undefined,accounts[11])).data.self.percent,1,'scores never decrease on a repeated journey or another device');
 assert.equal((await call('sync','POST',{countries:[{code:'PL',percent:101}]},accounts[11])).status,400);
 assert.equal((await call('sync','POST',{countries:[{code:'ZZ',percent:1}]},accounts[11])).status,400);
 assert.equal((await call('sync','POST',{countries:[{code:'PL',percent:1}]},accounts[11],'https://evil.example')).status,403);
 identity={userId:'00000000-0000-4000-8000-000000000011',email:'private-11@example.com'};
 assert.equal((await call('profile','POST',{nickname:'Explorer 0',homeCountry:'LT',consent:true})).status,409);
 assert.equal((await call('profile','POST',{nickname:'Explorer 11',homeCountry:'LT',consent:false})).status,400);
 assert.equal((await call('account','DELETE',undefined,accounts[11])).status,200);
 assert.equal((await call('me','GET',undefined,accounts[11])).status,401);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM profiles WHERE user_id=?').get('supabase:00000000-0000-4000-8000-000000000011').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM scores WHERE user_id=?').get('supabase:00000000-0000-4000-8000-000000000011').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM devices WHERE user_id=?').get('supabase:00000000-0000-4000-8000-000000000011').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM challenges WHERE user_id=?').get('supabase:00000000-0000-4000-8000-000000000011').n),0);
 assert.ok(deleted.has('00000000-0000-4000-8000-000000000011'),'deletion removes the authentication account as well');
 console.log('Account integration: verified external identity, unverified/forged rejection, consent, pairing proof, 12-user top 10 + true own rank, home flag, country separation, monotonic sync, validation, CORS, nickname uniqueness, privacy and account deletion passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
