'use client';
import{useState}from'react';
import{useExplorerAuth}from'../../auth-client';
export default function Reset(){
 const{client,session,authReady}=useExplorerAuth(),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 async function submit(event:React.FormEvent){event.preventDefault();if(!client||busy)return;setBusy(true);try{const{error}=await client.auth.updateUser({password});if(error)throw error;setPassword('');setDone(true);setMessage('Slaptažodis pakeistas. / Password updated.');}catch{setMessage('Nepavyko pakeisti slaptažodžio. Pradėk atkūrimą iš naujo. / Please request a new password reset link.');}finally{setBusy(false);}}
 return<article className="panel"><h1>Naujas slaptažodis / New password</h1>{!authReady?<p>…</p>:session&&!done?<form onSubmit={submit}><label>Slaptažodis / Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={10} maxLength={128} autoComplete="new-password"/></label><button className="button" disabled={busy}>Išsaugoti / Save</button></form>:!done?<p>Atidaryk naują atkūrimo nuorodą iš laiško. / Open a fresh password reset link from your email.</p>:null}<p role="status">{message}</p><a href="/account">Grįžti / Return</a></article>;
}
