/* Only aggregate country scores leave the device. Registration is optional. */
(() => {
  'use strict';
  const ORIGIN='https://etn-explorers.t0m45-p4k0.chatgpt.site',KEY='etn-community-v1',PENDING='etn-community-pending-v1';
  const $=id=>document.getElementById(id),{t,locale}=window.ETNI18n,{flag,formatPercent}=window.ETNInterface,state=window.ETNState;
  let session=null,pending=null,rankingSeq=0,syncing=false,polling=false,lastSync=0,syncTimer=null,starting=false;
  try{session=JSON.parse(localStorage.getItem(KEY)||'null');pending=JSON.parse(localStorage.getItem(PENDING)||'null');}catch{}
  if(!/^[a-f0-9]{64}$/.test(session?.token||''))session=null;
  if(!/^[a-f0-9]{40}$/.test(pending?.requestId||'')||pending?.expiresAt<Date.now())pending=null;
  const persist=()=>{try{if(session)localStorage.setItem(KEY,JSON.stringify(session));else localStorage.removeItem(KEY);if(pending)localStorage.setItem(PENDING,JSON.stringify(pending));else localStorage.removeItem(PENDING);}catch{}};
  function account(){
    $('profileDisplay').hidden=!session;$('connectAccount').hidden=!!session;$('connectedActions').hidden=!session;$('cancelConnect').hidden=!pending;
    $('accountNote').textContent=t(session?'connected':'guestNote');
    if(session){$('profileNickname').textContent=session.profile?.nickname||'';$('profileFlag').textContent=flag(session.profile?.homeCountry);}
    if(pending)$('accountStatus').textContent=t('connectPending')+' '+pending.code;
  }
  async function api(path,{method='GET',body,auth=true}={}){
    const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(auth&&session)headers.Authorization='Bearer '+session.token;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(ORIGIN+'/api/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,credentials:'omit',cache:'no-store'});
      const result=await response.json();if(!response.ok){const error=Error(result.error||'Request failed');error.status=response.status;throw error;}return result;
    }finally{clearTimeout(timer);}
  }
  function showCountry(){
    const country=state.country();$('leaderFlag').textContent=flag(country?.properties.code);
    $('leaderCountry').textContent=country?$('country').textContent:t('waitingLocation');
  }
  function row(data,self=false){
    const tr=document.createElement('tr');if(self)tr.className='is-me';
    const place=document.createElement('td'),name=document.createElement('td'),percent=document.createElement('td'),f=document.createElement('span');
    place.textContent=String(data.position);f.className='ranking-flag';f.textContent=flag(data.homeCountry);f.title=data.homeCountry||'';
    name.append(f,document.createTextNode(data.nickname+(self?' · '+t('yourRow'):'')));percent.textContent=formatPercent(data.percent);tr.append(place,name,percent);return tr;
  }
  async function ranking(){
    showCountry();const country=state.country()?.properties.code,seq=++rankingSeq;
    $('rankingRows').replaceChildren();
    if(!country){$('rankingStatus').textContent=t('noCountryRanking');return;}
    $('rankingStatus').textContent=t('loading');
    try{
      const data=await api('leaderboard?country='+encodeURIComponent(country));if(seq!==rankingSeq)return;
      for(const score of data.top)$('rankingRows').append(row(score,score.isMe));
      if(data.self&&data.self.position>10)$('rankingRows').append(row(data.self,true));
      $('rankingStatus').textContent=data.top.length?'':t('noExplorers');
    }catch{if(seq===rankingSeq)$('rankingStatus').textContent=t('rankingOffline');}
  }
  async function sync(full=false){
    if(!session||syncing)return;syncing=true;
    try{
      const progress=full?await state.allProgress():state.progress();
      const countries=progress.map(({code,percent})=>({code,percent}));
      await api('sync',{method:'POST',body:{countries}});lastSync=Date.now();$('accountStatus').textContent=t('syncComplete');
      if(!$('pageExplorers').hidden)await ranking();
    }catch(error){if(error.status===401){session=null;persist();account();}$('accountStatus').textContent=t('syncFailed');}
    finally{syncing=false;}
  }
  async function poll(){
    if(!pending||polling||document.hidden)return;
    if(pending.expiresAt<Date.now()){pending=null;persist();account();$('accountStatus').textContent=t('connectFailed');return;}
    const request=pending;
    polling=true;
    try{
      const result=await api('device/poll',{method:'POST',auth:false,body:{requestId:request.requestId,verifier:request.verifier}});
      if(result.status==='approved'&&pending?.requestId===request.requestId){
        session={token:request.verifier,profile:result.profile};pending=null;persist();account();$('accountStatus').textContent=t('connected');await sync(true);
      }
    }catch(error){if(error.status===410||error.status===403){pending=null;persist();account();$('accountStatus').textContent=t('connectFailed');}}
    finally{polling=false;}
  }
  $('connectAccount').onclick=async event=>{
    event.preventDefault();if(starting)return;
    if(pending){location.assign(pending.url);return;}
    starting=true;$('accountStatus').textContent=t('loading');
    try{
      const bytes=crypto.getRandomValues(new Uint8Array(32)),verifier=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),verifierHash=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
      const result=await api('device/start',{method:'POST',auth:false,body:{verifierHash}});
      const url=ORIGIN+'/connect/'+encodeURIComponent(result.requestId)+'?lang='+encodeURIComponent(locale);
      pending={requestId:result.requestId,verifier,code:result.code,expiresAt:result.expiresAt,url};persist();account();location.assign(url);
    }catch{$('accountStatus').textContent=t('connectFailed');}finally{starting=false;}
  };
  $('cancelConnect').onclick=()=>{pending=null;persist();account();$('accountStatus').textContent='';};
  $('disconnectAccount').onclick=async()=>{try{await api('logout',{method:'POST'});}catch{}session=null;persist();account();$('accountStatus').textContent='';ranking();};
  $('deleteAccount').onclick=async()=>{
    if(!confirm(t('deleteConfirm')))return;
    try{await api('account',{method:'DELETE'});session=null;persist();account();$('accountStatus').textContent=t('accountDeleted');ranking();}
    catch{$('accountStatus').textContent=t('syncFailed');}
  };
  $('syncAccount').onclick=()=>sync(true);$('refreshRanking').onclick=ranking;
  window.addEventListener('etn-country',()=>{showCountry();if(!$('pageExplorers').hidden)ranking();});
  window.addEventListener('etn-ranking-open',()=>{ranking();if(session&&Date.now()-lastSync>60000)sync(true);});
  window.addEventListener('etn-progress',()=>{if(!session)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(),Math.max(1000,60000-(Date.now()-lastSync)));});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){poll();if(session)sync();}});window.addEventListener('online',()=>{poll();if(session)sync();});
  setInterval(poll,2500);account();showCountry();poll();
  if(session)api('me').then(data=>{if(!session)return;session.profile=data.profile;persist();account();sync(true);}).catch(error=>{if(error.status===401){session=null;persist();account();}});
})();
