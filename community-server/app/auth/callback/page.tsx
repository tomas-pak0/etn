'use client';
import{useEffect,useState}from'react';
import{browserAuth}from'../../auth-client';
export default function Callback(){
 const[message,setMessage]=useState('Tikrinamas prisijungimas… / Verifying sign-in…');
 useEffect(()=>{let active=true;browserAuth().then(async({client})=>{
  const params=new URLSearchParams(location.search);if(params.has('error')||!client)throw Error();
  const{data,error}=await client.auth.getSession();if(error||!data.session)throw Error();
  const value=params.get('return_to')||'/account',target=new URL(value,location.origin);
  if(active)location.replace(target.origin===location.origin&&!target.pathname.startsWith('/auth/')?target.pathname+target.search:'/account');
 }).catch(()=>{if(active)setMessage('Patvirtink el. paštą ir prisijunk paskyros puslapyje. Jei nuorodą atidarei kitoje naršyklėje, grįžk į tą, kurioje pradėjai registraciją. / Verify your email, then sign in. If you opened the link in another browser, return to the browser where you registered.');});return()=>{active=false;};},[]);
 return<article className="panel"><h1>ETN</h1><p role="status">{message}</p><a className="button" href="/account">Prisijungti / Sign in</a></article>;
}
