/* Offline GeoNames settlement and country discoveries. GPS fixes alone trigger discoveries. */
(() => {
  'use strict';
  const {t,locale}=window.ETNI18n;
  const $=id=>document.getElementById(id);
  const number=new Intl.NumberFormat(locale);
  const names=type=>{try{return new Intl.DisplayNames([locale],{type})}catch{return null}};
  const regions=names('region'),languages=names('language'),currencies=names('currency');
  const tileCache=new Map();
  let index=null,indexPromise=null,adminPromise=null,dbPromise=null,chain=Promise.resolve(),activeEvent=null,discoveryError=false;
  const fallback={countries:new Set(),places:new Set(),events:[]};
  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(resolve=>{
      if(!window.indexedDB){resolve(null);return;}
      const request=indexedDB.open('etn-discoveries',1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        db.createObjectStore('visited');
        const queue=db.createObjectStore('queue',{keyPath:'id',autoIncrement:true});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>resolve(null);
    });
    return dbPromise;
  }
  async function count(code){
    const db=await openDB();
    if(!db)return [...fallback.places].filter(key=>key.startsWith(`p:${code}:`)).length;
    return new Promise(resolve=>{
      const tx=db.transaction('visited','readonly');
      const range=IDBKeyRange.bound(`p:${code}:`,`p:${code}:\uffff`);
      const req=tx.objectStore('visited').count(range);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(0);
    });
  }
  function transactVisit(key,event){
    return openDB().then(db=>new Promise((resolve,reject)=>{
      if(!db){
        if(fallback.places.has(key)||fallback.countries.has(key)){resolve(false);return;}
        (key.startsWith('p:')?fallback.places:fallback.countries).add(key);
        fallback.events.push({...event,id:fallback.events.length+1});resolve(true);return;
      }
      const tx=db.transaction(['visited','queue'],'readwrite');
      const store=tx.objectStore('visited');
      let inserted=false;
      store.get(key).onsuccess=e=>{
        if(e.target.result)return;
        store.put(true,key);tx.objectStore('queue').add(event);inserted=true;
      };
      tx.oncomplete=()=>resolve(inserted);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    }));
  }
  function firstEvent(){
    return openDB().then(db=>new Promise(resolve=>{
      if(!db){resolve(fallback.events[0]||null);return;}
      const req=db.transaction('queue','readonly').objectStore('queue').openCursor();
      req.onsuccess=()=>resolve(req.result?{...req.result.value,id:req.result.key}:null);
      req.onerror=()=>resolve(null);
    }));
  }
  function removeEvent(id){
    return openDB().then(db=>new Promise(resolve=>{
      if(!db){fallback.events.shift();resolve();return;}
      const tx=db.transaction('queue','readwrite');tx.objectStore('queue').delete(id);
      tx.oncomplete=resolve;tx.onerror=resolve;
    }));
  }
  async function unpack(path){
    const response=await fetch(path);
    if(!response.ok)throw Error(`Offline data unavailable: ${path}`);
    return JSON.parse(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text());
  }
  function loadIndex(){
    if(!indexPromise)indexPromise=unpack('data/places-index.bin').then(value=>(index=value,updateCount(),value)).catch(()=>null);
    return indexPromise;
  }
  function loadAdmin(){
    if(!adminPromise)adminPromise=Promise.all([unpack('data/admin1.bin'),unpack('data/admin2.bin')]).catch(()=>[{},{}]);
    return adminPromise;
  }
  const tileId=(lat,lon)=>`${String(Math.min(89,Math.max(0,Math.floor((lat+90)/2)))).padStart(2,'0')}-${String(Math.min(179,Math.max(0,Math.floor((lon+180)/2)))).padStart(3,'0')}`;
  function loadTile(id){
    if(tileCache.has(id))return tileCache.get(id);
    const promise=unpack(`data/places/${id}.bin`).then(records=>{
      const grid=new Map();
      for(const row of records){
        const key=`${Math.floor(row[2]*50)}:${Math.floor(row[3]*50)}`;
        if(!grid.has(key))grid.set(key,[]);
        grid.get(key).push(row);
      }
      return grid;
    });
    tileCache.set(id,promise);
    if(tileCache.size>12)tileCache.delete(tileCache.keys().next().value);
    return promise;
  }
  function near(lat,lon){
    const keys=new Set();
    for(const dLat of [-.015,0,.015])for(const dLon of [-.04,0,.04])keys.add(tileId(lat+dLat,lon+dLon));
    return [...keys].filter(id=>index.tilesSet.has(id));
  }
  function distance(lat,lon,row){
    const x=(lon-row[3])*111320*Math.cos(lat*Math.PI/180),y=(lat-row[2])*111320;
    return Math.hypot(x,y);
  }
  function radius(row){
    if(row[5]==='PPLC'||row[5]==='PPLA')return 1000;
    if(row[5].startsWith('PPLA'))return 700;
    if(row[8]>=100000)return 1000;
    if(row[8]>=10000)return 700;
    if(row[8]>=1000)return 500;
    return 350;
  }
  async function updateCount(code=window.ETNCurrentCountry?.properties.code){
    const target=$('settlementProgress');
    if(!target)return;
    if(!code){target.textContent='–';return;}
    if(!index){target.textContent=t('calculating');return;}
    const total=index.counts[code]||0;
    if(!total){target.textContent=t('noSettlementData');return;}
    const found=await count(code);
    target.textContent=`${number.format(found)} / ${number.format(total)} · ${new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(100*found/total)} %`;
  }
  const localizedCountry=(code,fallbackName)=>{try{return regions?.of(code)||fallbackName||code}catch{return fallbackName||code}};
  function countryDetails(code){
    const info=index?.countries[code];
    if(!info)return [];
    const items=[];
    if(info.capital)items.push([t('capital'),info.capital]);
    if(info.population)items.push([t('population'),`${t('about')} ${number.format(info.population)}`]);
    const spoken=info.languages.filter(Boolean).slice(0,3).map(tag=>{
      const base=tag.split('-')[0];try{return languages?.of(base)||base}catch{return base}
    });
    if(spoken.length)items.push([t('languages'),spoken.join(', ')]);
    if(info.currency){let label=info.currency;try{label=currencies?.of(info.currency)||label}catch{}
      items.push([t('currency'),`${label} (${info.currency})`]);}
    return items;
  }
  async function showNext(){
    if(document.hidden||activeEvent)return;
    const event=await firstEvent();
    if(!event)return;
    activeEvent=event;
    const modal=$('discoveryDialog');
    $('discoveryTitle').textContent=event.type==='country'?t('countryFound'):t('settlementFound');
    $('discoveryName').textContent=event.type==='country'
      ?`${String.fromCodePoint(...[...event.code].map(ch=>127397+ch.charCodeAt(0)))} ${localizedCountry(event.code,event.name)}`:event.name;
    const details=event.type==='country'?countryDetails(event.code):[
      [t('country'),localizedCountry(event.code,index?.countries[event.code]?.name)],
      ...(event.admin1?[[event.code==='LT'?t('county'):t('region'),event.admin1]]:[]),
      ...(event.admin2?[[event.code==='LT'?t('municipality'):t('district'),event.admin2]]:[]),
      ...(event.population?[[t('population'),`${t('about')} ${number.format(event.population)}`]]:[])
    ];
    const list=$('discoveryFacts');list.replaceChildren();
    for(const [label,value] of details){const item=document.createElement('div');
      const term=document.createElement('dt'),description=document.createElement('dd');
      term.textContent=label;description.textContent=value;item.append(term,description);list.append(item);}
    modal.hidden=false;$('discoveryClose').focus();
  }
  $('discoveryClose').onclick=async()=>{
    if(!activeEvent)return;
    await removeEvent(activeEvent.id);activeEvent=null;
    $('discoveryDialog').hidden=true;showNext();
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)showNext()});
  async function observe(lat,lon,feature){
    const snapshot=await loadIndex();if(!snapshot)throw Error('Settlement index unavailable');
    if(!feature)return;
    const code=feature.properties.code;if(!code)return;
    if(await transactVisit(`c:${code}`,{type:'country',code,name:feature.properties.name}))showNext();
    const [admin1,admin2]=await loadAdmin();
    const candidates=new Map();
    for(const tile of near(lat,lon)){
      const grid=await loadTile(tile);
      for(let y=Math.floor(lat*50)-1;y<=Math.floor(lat*50)+1;y++){
        for(let x=Math.floor(lon*50)-1;x<=Math.floor(lon*50)+1;x++){
          for(const row of grid.get(`${y}:${x}`)||[]){
            if(row[4]===code&&distance(lat,lon,row)<=radius(row))candidates.set(row[0],row);
          }
        }
      }
    }
    for(const row of candidates.values()){
      if(await transactVisit(`p:${code}:${row[0]}`,{type:'settlement',code,name:row[1],
        admin1:admin1[`${code}.${row[6]}`]||'',admin2:admin2[`${code}.${row[6]}.${row[7]}`]||'',population:row[8]})){
        updateCount(code);showNext();
      }
    }
  }
  function enqueue(lat,lon,feature){
    chain=chain.then(()=>observe(lat,lon,feature)).catch(()=>{discoveryError=true});
    return chain;
  }
  function flush(){return chain.then(()=>{
    if(discoveryError){discoveryError=false;throw Error('Discovery data could not be stored');}
  });}
  loadIndex().then(value=>{if(value)value.tilesSet=new Set(value.tiles);showNext()});
  window.ETNDiscoveries={enqueue,flush,updateCount};
})();
