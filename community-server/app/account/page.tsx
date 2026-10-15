import { getChatGPTUser,chatGPTSignInPath,chatGPTSignOutPath } from '../chatgpt-auth';
import Portal from '../portal';
export const dynamic='force-dynamic';
export default async function Account(){const user=await getChatGPTUser();return <Portal signedIn={!!user} signInPath={chatGPTSignInPath('/account')} signOutPath={chatGPTSignOutPath('/')} />;}
