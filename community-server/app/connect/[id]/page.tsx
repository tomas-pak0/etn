import { getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath } from '../../chatgpt-auth';
import Portal from '../../portal';
export const dynamic='force-dynamic';
export default async function Connect({params,searchParams}:{params:Promise<{id:string}>,searchParams:Promise<{lang?:string}>}){const {id}=await params,{lang}=await searchParams,user=await getChatGPTUser();const target='/connect/'+encodeURIComponent(id)+'?lang='+encodeURIComponent(lang||'en');return <Portal signedIn={!!user} requestId={id} language={lang} signInPath={chatGPTSignInPath(target)} signOutPath={chatGPTSignOutPath('/')} />;}
