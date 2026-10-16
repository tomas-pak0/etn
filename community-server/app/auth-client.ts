'use client';
import {createClient,type SupabaseClient,type Session} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
import type {AuthConfig} from './explorer-auth';

let clientPromise:Promise<{client:SupabaseClient|null;config:AuthConfig}>|null=null;
export function browserAuth(){
  if(!clientPromise)clientPromise=fetch('/api/auth/config',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw Error('auth_unavailable');const config=await response.json() as AuthConfig;
    return{config,client:config.enabled?createClient(config.url,config.publishableKey,{auth:{flowType:'pkce',storageKey:'etn-auth-v2',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null};
  }).catch(error=>{clientPromise=null;throw error;});
  return clientPromise;
}
export function useExplorerAuth(){
  const[client,setClient]=useState<SupabaseClient|null>(null),[config,setConfig]=useState<AuthConfig|null>(null),[session,setSession]=useState<Session|null>(null),[authReady,setReady]=useState(false);
  useEffect(()=>{
    let active=true,unsubscribe=()=>{};
    browserAuth().then(async result=>{
      if(!active)return;setClient(result.client);setConfig(result.config);
      if(result.client){
        const{data}=await result.client.auth.getSession();if(!active)return;setSession(data.session);
        const change=result.client.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next);});unsubscribe=()=>change.data.subscription.unsubscribe();
      }
    }).catch(()=>{}).finally(()=>{if(active)setReady(true);});
    return()=>{active=false;unsubscribe();};
  },[]);
  return{client,config,session,authReady};
}
export async function authenticatedFetch(client:SupabaseClient|null,path:string,init:RequestInit={}){
  const session=await client?.auth.getSession(),token=session?.data.session?.access_token;
  if(!token)throw Error('sign_in_required');
  return fetch(path,{...init,cache:'no-store',headers:{...init.headers,Authorization:'Bearer '+token}});
}
export function callbackUrl(){return location.origin+'/auth/callback?return_to='+encodeURIComponent(location.pathname+location.search);}
