import { env } from 'cloudflare:workers';
import { AuthError,publicAuthConfig,verifiedIdentity,requireAccountDeletion,deleteAuthIdentity } from './explorer-auth';
export const countryCodes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const codes=new Set(countryCodes);
export const validCountry=(code:unknown):code is string=>typeof code==='string'&&codes.has(code);
type Profile={user_id:string;nickname:string;home_country:string};
type Challenge={id:string;verifier_hash:string;code:string;user_id:string|null;expires_at:number};
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
export const digest=async(value:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
const db=()=>{if(!env.DB)throw new Error('Database unavailable');return env.DB;};
const publicProfile=(p:Profile)=>({nickname:p.nickname,homeCountry:p.home_country});
const profile=(id:string)=>db().prepare('SELECT * FROM profiles WHERE user_id=?').bind(id).first<Profile>();
class ApiError extends Error{constructor(public status:number,message:string){super(message);}}
async function body(request:Request){
  if(Number(request.headers.get('content-length')||0)>20000)throw new ApiError(413,'Request too large');
  const raw=await request.text();if(raw.length>20000)throw new ApiError(413,'Request too large');
  try{const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new ApiError(400,'Invalid JSON');}
}
async function webIdentity(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new ApiError(403,'Origin not allowed');
  return verifiedIdentity(request);
}
async function mobileIdentity(request:Request,required=true){
  const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token){if(required)throw new ApiError(401,'Sign in required');return null;}
  const row=await db().prepare('SELECT user_id FROM devices WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first<{user_id:string}>();
  if(!row&&required)throw new ApiError(401,'Session expired');return row?.user_id||null;
}
async function rate(request:Request,bucket:string,max:number,seconds=60){
  const now=Date.now(),ip=request.headers.get('cf-connecting-ip')||'unknown',period=Math.floor(now/(seconds*1000));
  const key=await digest(ip+':'+bucket+':'+period);
  const row=await db().prepare('INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now+seconds*1000).first<{hits:number}>();
  if((row?.hits||0)>max)throw new ApiError(429,'Too many requests');
}
async function removeAccount(id:string){await db().batch([
  db().prepare('DELETE FROM devices WHERE user_id=?').bind(id),db().prepare('DELETE FROM challenges WHERE user_id=?').bind(id),
  db().prepare('DELETE FROM scores WHERE user_id=?').bind(id),db().prepare('DELETE FROM profiles WHERE user_id=?').bind(id)]);}
async function handle(request:Request,path:string){
  const now=Date.now(),url=new URL(request.url),method=request.method;
  if(method==='GET'&&path==='auth/config')return publicAuthConfig();
  if(method==='POST'&&path==='device/start'){
    await rate(request,'device',12,600);const data=await body(request);
    if(!/^[a-f0-9]{64}$/.test(data.verifierHash))throw new ApiError(400,'Invalid verifier');
    const id=random().slice(0,40),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0'),expires=now+600000;
    await db().batch([db().prepare('DELETE FROM challenges WHERE expires_at<?').bind(now),db().prepare('DELETE FROM devices WHERE expires_at<?').bind(now),db().prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),db().prepare('INSERT INTO challenges(id,verifier_hash,code,expires_at,created_at) VALUES(?,?,?,?,?)').bind(id,data.verifierHash,code,expires,now)]);
    return {requestId:id,code,expiresAt:expires,connectUrl:url.origin+'/connect/'+id};
  }
  if(method==='GET'&&path==='device/info'){
    const id=url.searchParams.get('id');if(!/^[a-f0-9]{40}$/.test(id||''))throw new ApiError(400,'Invalid request');
    const row=await db().prepare('SELECT code,expires_at FROM challenges WHERE id=? AND expires_at>?').bind(id,now).first();if(!row)throw new ApiError(410,'Request expired');return row;
  }
  if(method==='POST'&&path==='device/poll'){
    await rate(request,'poll',50);const data=await body(request);
    if(!/^[a-f0-9]{40}$/.test(data.requestId)||!/^[a-f0-9]{64}$/.test(data.verifier))throw new ApiError(400,'Invalid request');
    const row=await db().prepare('SELECT * FROM challenges WHERE id=? AND expires_at>?').bind(data.requestId,now).first<Challenge>();
    if(!row)throw new ApiError(410,'Request expired');if(await digest(data.verifier)!==row.verifier_hash)throw new ApiError(403,'Invalid verifier');if(!row.user_id)return {status:'pending'};
    const p=await profile(row.user_id);if(!p)throw new ApiError(410,'Account removed');
    await db().prepare('INSERT INTO devices(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at').bind(row.verifier_hash,row.user_id,now,now+180*86400000).run();
    return {status:'approved',profile:publicProfile(p)};
  }
  if(method==='POST'&&path==='device/approve'){
    const id=await webIdentity(request),data=await body(request);if(!/^[a-f0-9]{40}$/.test(data.requestId)||data.consent!==true)throw new ApiError(400,'Consent required');
    if(!await profile(id))throw new ApiError(400,'Create your profile first');
    const result=await db().prepare('UPDATE challenges SET user_id=? WHERE id=? AND expires_at>? AND (user_id IS NULL OR user_id=?)').bind(id,data.requestId,now,id).run();
    if(!result.meta.changes)throw new ApiError(410,'Request expired or already used');return {ok:true};
  }
  if(method==='GET'&&path==='profile'){
    const id=await verifiedIdentity(request),p=await profile(id);return {profile:p?publicProfile(p):null};
  }
  if(method==='POST'&&path==='profile'){
    const id=await webIdentity(request),data=await body(request),nickname=typeof data.nickname==='string'?data.nickname.trim().normalize('NFKC'):'';
    if(!/^[\p{L}\p{N} _.-]{3,24}$/u.test(nickname))throw new ApiError(400,'nickname_invalid');
    if(!validCountry(data.homeCountry)||data.consent!==true)throw new ApiError(400,'consent_required');
    const nicknameKey=nickname.toLowerCase(),existing=await db().prepare('SELECT user_id FROM profiles WHERE nickname_key=?').bind(nicknameKey).first<{user_id:string}>();
    if(existing&&existing.user_id!==id)throw new ApiError(409,'nickname_taken');
    try{await db().prepare('INSERT INTO profiles(user_id,nickname,nickname_key,home_country,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nickname=excluded.nickname,nickname_key=excluded.nickname_key,home_country=excluded.home_country,updated_at=excluded.updated_at').bind(id,nickname,nicknameKey,data.homeCountry,now,now).run();}catch{throw new ApiError(409,'nickname_taken');}
    return {profile:{nickname,homeCountry:data.homeCountry}};
  }
  if(method==='GET'&&path==='me'){const id=await mobileIdentity(request),p=await profile(id!);if(!p)throw new ApiError(401,'Account removed');return {profile:publicProfile(p)};}
  if(method==='POST'&&path==='sync'){
    const id=await mobileIdentity(request);await rate(request,'sync',30);const data=await body(request);
    if(!Array.isArray(data.countries)||data.countries.length>250)throw new ApiError(400,'Invalid scores');const seen=new Set<string>();
    for(const row of data.countries){if(!row||!validCountry(row.code)||seen.has(row.code)||typeof row.percent!=='number'||!Number.isFinite(row.percent)||row.percent<0||row.percent>100)throw new ApiError(400,'Invalid score');seen.add(row.code);}
    if(data.countries.length)await db().batch(data.countries.map((row:{code:string;percent:number})=>db().prepare('INSERT INTO scores(user_id,country,percentage,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,country) DO UPDATE SET percentage=MAX(scores.percentage,excluded.percentage),updated_at=CASE WHEN excluded.percentage>scores.percentage THEN excluded.updated_at ELSE scores.updated_at END').bind(id,row.code,row.percent,now)));
    return {ok:true,syncedAt:now};
  }
  if(method==='GET'&&path==='leaderboard'){
    const country=url.searchParams.get('country');if(!validCountry(country))throw new ApiError(400,'Invalid country');await rate(request,'ranking',120);const id=await mobileIdentity(request,false);
    const result=await db().prepare(`WITH ranked AS (SELECT p.user_id,p.nickname,p.home_country,s.percentage,ROW_NUMBER() OVER(ORDER BY s.percentage DESC,s.updated_at ASC,p.user_id ASC) AS position,COUNT(*) OVER() AS total FROM scores s JOIN profiles p ON p.user_id=s.user_id WHERE s.country=? AND s.percentage>0) SELECT * FROM ranked WHERE position<=10 OR user_id=? ORDER BY position`).bind(country,id||'').all<{user_id:string;nickname:string;home_country:string;percentage:number;position:number;total:number}>();
    const rows=result.results.map(row=>({nickname:row.nickname,homeCountry:row.home_country,percent:row.percentage,position:row.position,isMe:row.user_id===id}));return {country,total:result.results[0]?.total||0,top:rows.filter(row=>row.position<=10),self:rows.find(row=>row.isMe)||null,updatedAt:now};
  }
  if(method==='POST'&&path==='logout'){
    await mobileIdentity(request);const hash=await digest(request.headers.get('authorization')!.slice(7));await db().batch([db().prepare('DELETE FROM devices WHERE token_hash=?').bind(hash),db().prepare('DELETE FROM challenges WHERE verifier_hash=?').bind(hash)]);return {ok:true};
  }
  if(method==='DELETE'&&path==='account'){
    const mobile=/^Bearer [a-f0-9]{64}$/.test(request.headers.get('authorization')||'');
    const id=mobile?await mobileIdentity(request):await webIdentity(request);
    if(id!.startsWith('supabase:'))requireAccountDeletion();
    await removeAccount(id!);await deleteAuthIdentity(id!);return {ok:true};
  }
  throw new ApiError(404,'Not found');
}
export async function api(request:Request,path:string){
  const origin=request.headers.get('origin'),allowed=new Set(['https://appassets.androidplatform.net',new URL(request.url).origin]);
  const headers:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin&&allowed.has(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Content-Type, Authorization';headers['Access-Control-Allow-Methods']='GET, POST, DELETE, OPTIONS';}
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(origin&&!allowed.has(origin))return Response.json({error:'Origin not allowed'},{status:403,headers});
  try{return Response.json(await handle(request,path),{headers});}catch(error){if(error instanceof ApiError||error instanceof AuthError)return Response.json({error:error.message},{status:error.status,headers});return Response.json({error:'Service temporarily unavailable'},{status:503,headers});}
}
