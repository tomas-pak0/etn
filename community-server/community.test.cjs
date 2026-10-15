const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),ts=require('typescript');
const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/'+fs.readdirSync('drizzle').find(f=>f.endsWith('.sql')),'utf8'));
const statement=text=>({args:[],bind(...args){this.args=args;return this;},async first(){return sql.prepare(text).get(...this.args)||null;},async all(){return{results:sql.prepare(text).all(...this.args)};},async run(){const result=sql.prepare(text).run(...this.args);return{meta:{changes:Number(result.changes)}};}});
const DB={prepare:statement,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let identity=null;
const context={exports:{},require:name=>name==='cloudflare:workers'?{env:{DB}}:{getChatGPTUser:async()=>identity},crypto:globalThis.crypto,Request,Response,URL,TextEncoder,Uint8Array,Uint32Array,Date,Set,Error,console};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/community.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const {api,digest}=context.exports,origin='https://test.example';
async function call(path,method='GET',body,token,otherOrigin=origin){const headers={'Origin':otherOrigin,'cf-connecting-ip':identity?.userId||'visitor'};if(token)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';const response=await api(new Request(origin+'/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),path.split('?')[0]);return{status:response.status,headers:response.headers,data:await response.json()};}
(async()=>{
 const accounts=[];
 assert.equal((await call('sync','POST',{countries:[]})).status,401,'anonymous score writes are blocked');
 assert.equal((await call('profile','POST',{nickname:'bad',homeCountry:'LT',consent:true})).status,401);
 for(let i=0;i<12;i++){
  identity={userId:'user-'+i,email:'private-'+i+'@example.com'};
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
 identity={userId:'user-11',email:'private-11@example.com'};
 assert.equal((await call('profile','POST',{nickname:'Explorer 0',homeCountry:'LT',consent:true})).status,409);
 assert.equal((await call('profile','POST',{nickname:'Explorer 11',homeCountry:'LT',consent:false})).status,400);
 assert.equal((await call('account','DELETE',undefined,accounts[11])).status,200);
 assert.equal((await call('me','GET',undefined,accounts[11])).status,401);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM profiles WHERE user_id=?').get('user-11').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM scores WHERE user_id=?').get('user-11').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM devices WHERE user_id=?').get('user-11').n),0);
 assert.equal(Number(sql.prepare('SELECT count(*) n FROM challenges WHERE user_id=?').get('user-11').n),0);
 console.log('Account integration: browser identity, consent, pairing proof, 12-user top 10 + true own rank, home flag, country separation, monotonic sync, validation, CORS, nickname uniqueness, privacy and account deletion passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
