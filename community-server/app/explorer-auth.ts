import { env } from 'cloudflare:workers';

export type AuthConfig={enabled:boolean;url:string;publishableKey:string;providers:{google:boolean;facebook:boolean;email:boolean}};
export class AuthError extends Error{constructor(public status:number,message:string){super(message);}}
type AuthUser={id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean;app_metadata?:{provider?:string}};
function settings(){
  const url=env.SUPABASE_URL?.replace(/\/$/,'')||'',key=env.SUPABASE_PUBLISHABLE_KEY||'';
  let validKey=key.startsWith('sb_publishable_');
  if(!validKey){try{validKey=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}}
  if(!/^https:\/\/[^/?#]+$/.test(url)||!validKey)throw new AuthError(503,'auth_unavailable');
  return{url,key};
}
async function providerRequest(path:string,init:RequestInit={}){
  const{url,key}=settings();
  try{return await fetch(url+'/auth/v1/'+path,{...init,headers:{apikey:key,...init.headers},signal:AbortSignal.timeout(10000)});}
  catch{throw new AuthError(503,'auth_unavailable');}
}
let cachedConfig:{at:number;value:AuthConfig}|null=null;
export async function publicAuthConfig():Promise<AuthConfig>{
  const disabled={enabled:false,url:'',publishableKey:'',providers:{google:false,facebook:false,email:false}};
  try{
    const{url,key}=settings();if(cachedConfig&&Date.now()-cachedConfig.at<60000)return cachedConfig.value;
    const response=await providerRequest('settings');if(!response.ok)return disabled;
    const data=await response.json() as {external?:Record<string,boolean>;mailer_autoconfirm?:boolean};
    const value={enabled:true,url,publishableKey:key,providers:{google:data.external?.google===true,facebook:data.external?.facebook===true,email:data.external?.email===true&&data.mailer_autoconfirm===false}};
    cachedConfig={at:Date.now(),value};return value;
  }catch{return disabled;}
}
export async function verifiedIdentity(request:Request):Promise<string>{
  const token=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if(!token||token.length>8192)throw new AuthError(401,'sign_in_required');
  const response=await providerRequest('user',{headers:{Authorization:'Bearer '+token}});
  if(response.status===401||response.status===403)throw new AuthError(401,'session_expired');
  if(!response.ok)throw new AuthError(503,'auth_unavailable');
  const user=await response.json() as AuthUser;
  if(!/^[0-9a-f-]{36}$/i.test(user.id||'')||user.is_anonymous)throw new AuthError(401,'sign_in_required');
  if(!user.email||!user.email_confirmed_at||!Number.isFinite(Date.parse(user.email_confirmed_at)))throw new AuthError(403,'email_not_verified');
  if(user.app_metadata?.provider==='email'&&!(await publicAuthConfig()).providers.email)throw new AuthError(403,'email_verification_required');
  return 'supabase:'+user.id.toLowerCase();
}
export function requireAccountDeletion(){if(!env.SUPABASE_SECRET_KEY)throw new AuthError(503,'account_deletion_unavailable');}
export async function deleteAuthIdentity(id:string){
  if(!id.startsWith('supabase:'))return;
  requireAccountDeletion();const{url}=settings(),secret=env.SUPABASE_SECRET_KEY!;
  let response:Response;
  try{response=await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(id.slice(9)),{method:'DELETE',headers:{apikey:secret,Authorization:'Bearer '+secret},signal:AbortSignal.timeout(10000)});}
  catch{throw new AuthError(503,'account_deletion_unavailable');}
  if(!response.ok&&response.status!==404)throw new AuthError(503,'account_deletion_unavailable');
}
