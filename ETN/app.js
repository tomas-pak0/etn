/* ETN prototype: geographical fog over the Leaflet map used by Kur aš? */
(() => {
  'use strict';
  const KEY='etn-explored-v1', LOOPS_KEY='etn-enclosed-v1';
  const MAX_ACCURACY=100, MAX_POINTS=5000, MAX_LOOPS=100;
  const MAX_RADIUS=5000, CLEAR_RADIUS=500;
  const $=id=>document.getElementById(id);
  const {t,locale}=window.ETNI18n;
  const native=window.ETNNative||null;
  let screenLock=null,screenLockPending=false;
  async function keepScreenAwake(){
    if(document.hidden||screenLock||screenLockPending||!navigator.wakeLock?.request)return;
    screenLockPending=true;
    try{
      const lock=await navigator.wakeLock.request('screen');
      if(document.hidden){await lock.release();return;}
      screenLock=lock;
      lock.addEventListener('release',()=>{if(screenLock===lock)screenLock=null;});
    }catch{ /* The system can deny a screen lock, for example in power saving mode. */ }
    finally{screenLockPending=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)keepScreenAwake();});
  window.addEventListener('pageshow',keepScreenAwake);
  setInterval(keepScreenAwake,30000);
  keepScreenAwake();
  const map=L.map('map',{zoomControl:false,zoomSnap:0,zoomDelta:.5}).setView([55.1694,23.8813],7);
  const locationBounds=point=>L.latLng(point).toBounds(MAX_RADIUS*2);
  const overviewOptions={padding:[40,40],animate:true};
  L.control.zoom({position:'bottomright'}).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  function load(){
    try{
      const data=JSON.parse(localStorage.getItem(KEY)||'[]');
      return Array.isArray(data)?data.slice(-MAX_POINTS).filter(p=>
        Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&
        Number.isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180)
        .map(p=>[p[0],p[1]]):[];
    }catch{return [];}
  }
  function loadLoops(){
    try{
      const saved=JSON.parse(localStorage.getItem(LOOPS_KEY)||'[]');
      return Array.isArray(saved)?saved.slice(-MAX_LOOPS).filter(ring=>
        Array.isArray(ring)&&ring.length>=7&&ring.length<=MAX_POINTS&&
        ring.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&
          Number.isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180)):[];
    }catch{return [];}
  }
  let points=load(),loops=loadLoops(),trail=[],watcher=null,lastFix=null,latestPosition=null,marker=null,queued=false;
  let importing=false;
  try{localStorage.setItem(KEY,JSON.stringify(points))}catch{}
  let countries=[],currentCountry=null,progressTimer=null,lastProgressAt=0,progressCountry=null,bordersReady=false;
  const discovery=window.ETNDiscoveries;
  const waitingDiscoveries=[];
  function discoverFix(lat,lon,time=Date.now()){
    if(!bordersReady){waitingDiscoveries.push([lat,lon,time]);return;}
    discovery.enqueue(lat,lon,findCountry([lat,lon]),time);
  }
  let worldActive=false;
  const FOLLOW_KEY='etn-follow-position-v1';
  let followPosition=true;
  try{followPosition=localStorage.getItem(FOLLOW_KEY)!=='false';}catch{}
  function setFollowPosition(value){
    followPosition=value;
    try{localStorage.setItem(FOLLOW_KEY,String(value));}catch{}
  }
  const worldView=$('worldView'),worldCanvas=$('worldCanvas');
  const countryNames=typeof Intl.DisplayNames==='function'
    ?new Intl.DisplayNames([locale],{type:'region'}):null;
  const countryName=feature=>{
    const code=feature.properties.code;
    return /^[A-Z]{2}$/.test(code||'')&&countryNames
      ?countryNames.of(code):feature.properties.name;
  };
  const countryFlag=code=>/^[A-Z]{2}$/.test(code||'')
    ?String.fromCodePoint(...[...code].map(letter=>127397+letter.charCodeAt(0))):'🌐';
  function rings(feature){
    const g=feature.geometry;
    return g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  }
  function inRing(lon,lat,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const [xi,yi]=ring[i],[xj,yj]=ring[j];
      if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function inCountry(lon,lat,feature){
    const [west,south,east,north]=feature.bounds;
    if(lon<west||lon>east||lat<south||lat>north)return false;
    return rings(feature).some(polygon=>inRing(lon,lat,polygon[0])&&
      !polygon.slice(1).some(hole=>inRing(lon,lat,hole)));
  }
  function sphericalArea(ring){
    let sum=0;
    for(let i=0;i<ring.length-1;i++){
      const a=ring[i],b=ring[i+1];
      let delta=(b[0]-a[0])*Math.PI/180;
      if(delta>Math.PI)delta-=2*Math.PI;
      if(delta< -Math.PI)delta+=2*Math.PI;
      sum+=delta*(Math.sin(a[1]*Math.PI/180)+Math.sin(b[1]*Math.PI/180));
    }
    return Math.abs(sum)*6371008.8**2/2;
  }
  function prepareCountry(feature){
    const bounds=[180,90,-180,-90];
    let area=0;
    for(const polygon of rings(feature)){
      for(let i=0;i<polygon.length;i++){
        const ring=polygon[i];
        area+=(i===0?1:-1)*sphericalArea(ring);
        for(const [lon,lat] of ring){
          bounds[0]=Math.min(bounds[0],lon);bounds[1]=Math.min(bounds[1],lat);
          bounds[2]=Math.max(bounds[2],lon);bounds[3]=Math.max(bounds[3],lat);
        }
      }
    }
    feature.bounds=bounds;feature.area=Math.max(area,1);
    return feature;
  }
  function updateBorders(){
    redraw();
    if(worldActive)renderWorld();
  }
  map.on('moveend',updateBorders);
  function findCountry(point){
    // Prefer the previous country on a shared border to avoid label flicker.
    const [lat,lon]=point;
    if(currentCountry&&inCountry(lon,lat,currentCountry))return currentCountry;
    return countries.find(feature=>inCountry(lon,lat,feature))||null;
  }
  async function loadCountries(){
    try{
      const response=await fetch('data/countries-50m.bin');
      if(!response.ok)throw Error('Country boundaries unavailable');
      const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
      const data=JSON.parse(await new Response(stream).text());
      if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Invalid borders');
      countries=data.features.map(prepareCountry);
      if(marker)setCountry(marker.getLatLng());
      bordersReady=true;
      for(const [lat,lon,time] of waitingDiscoveries)discoverFix(lat,lon,time);
      waitingDiscoveries.length=0;
      updateBorders();
    }catch{
      bordersReady=true;
      $('country').textContent=t('bordersUnavailable');
      $('countryProgress').textContent='–';
    }
  }
  function setCountry(point){
    if(!countries.length)return;
    const found=findCountry([point.lat,point.lng]);
    if(found===currentCountry)return;
    currentCountry=found;
    window.ETNCurrentCountry=found;
    discovery.updateCount(found?.properties.code);
    $('country').textContent=found?countryName(found):t('outsideCountries');
    $('countryFlag').textContent=found?countryFlag(found.properties.code):'🌐';
    $('countryProgress').textContent=found?t('calculating'):'–';
    updateBorders();scheduleProgress();
  }
  function zoomToCountry(feature){
    if(!feature)return;
    $('countryPicker').hidden=true;
    if(worldActive)$('worldButton').onclick();
    setFollowPosition(false);
    const [west,south,east,north]=feature.bounds;
    map.invalidateSize();
    map.fitBounds([[south,west],[north,east]],{padding:[24,24],animate:true});
    $('status').textContent=t('viewingCountry',{country:countryName(feature)});
  }
  $('closeCountries').onclick=()=>{$('countryPicker').hidden=true;};
  $('countryCard').onclick=()=>{
    if(!countries.length){$('status').textContent=t('loadingBorders');return;}
    const visited=new Set();
    for(const [lat,lon] of points){
      const feature=countries.find(candidate=>inCountry(lon,lat,candidate));
      if(feature)visited.add(feature);
    }
    if(currentCountry)visited.add(currentCountry);
    const options=[...visited];
    if(options.length<2){zoomToCountry(options[0]);return;}
    options.sort((a,b)=>countryName(a).localeCompare(countryName(b),'lt'));
    const container=$('countryOptions');container.replaceChildren();
    for(const feature of options){
      const button=document.createElement('button');
      button.type='button';button.textContent=countryFlag(feature.properties.code)+' '+countryName(feature);
      button.onclick=()=>zoomToCountry(feature);
      container.appendChild(button);
    }
    $('countryPicker').hidden=false;
  };
  // Only a deliberate map gesture pauses following. GPS-driven pans do not.
  let mapGesture=false;
  map.getContainer().addEventListener('pointerdown',event=>{
    if(event.target.closest('.leaflet-control-zoom'))setFollowPosition(false);
    else if(!event.target.closest('.leaflet-control'))mapGesture=true;
  });
  window.addEventListener('pointerup',()=>{mapGesture=false;});
  window.addEventListener('pointercancel',()=>{mapGesture=false;});
  map.getContainer().addEventListener('wheel',()=>setFollowPosition(false),{passive:true});
  map.on('dragstart',()=>setFollowPosition(false));
  map.on('movestart',()=>{if(mapGesture)setFollowPosition(false);});
  function pointVisibility(distance){
    if(distance<=CLEAR_RADIUS)return 1;
    if(distance>=MAX_RADIUS)return 0;
    return (MAX_RADIUS-distance)/(MAX_RADIUS-CLEAR_RADIUS);
  }
  function exploredPercent(feature){
    // A coarse grid approximates the union of all visibility masks. Each cell
    // retains its greatest visibility, matching the on-screen fog composition.
    const [west,south,east,north]=feature.bounds;
    const baseLat=(south+north)/2,cosBase=Math.max(.01,Math.cos(baseLat*Math.PI/180));
    const step=500,metersPerDegree=111195;
    const latAt=y=>south+(y+.5)*step/metersPerDegree;
    const lonAt=x=>west+(x+.5)*step/(metersPerDegree*cosBase);
    const cells=new Map();
    const add=(x,y,visibility)=>{
      if(visibility<=0)return;
      const lon=lonAt(x),lat=latAt(y);
      if(!inCountry(lon,lat,feature))return;
      const key=x+','+y;
      if(visibility>(cells.get(key)||0))cells.set(key,visibility);
    };
    const visited=new Set();
    for(const [lat,lon] of points){
      const maxRadius=MAX_RADIUS;
      const bucket=Math.floor(lat*1112)+','+Math.floor(lon*1112*cosBase);
      if(visited.has(bucket))continue;
      visited.add(bucket);
      if(lon<(west-maxRadius/(111195*cosBase))||lon>(east+maxRadius/(111195*cosBase))||
        lat<(south-maxRadius/111195)||lat>(north+maxRadius/111195))continue;
      const cx=(lon-west)*metersPerDegree*cosBase/step-.5;
      const cy=(lat-south)*metersPerDegree/step-.5;
      const reach=Math.ceil(maxRadius/step)+1;
      for(let y=Math.floor(cy-reach);y<=Math.ceil(cy+reach);y++){
        const sampleLat=latAt(y),dy=(sampleLat-lat)*metersPerDegree;
        if(Math.abs(dy)>=maxRadius)continue;
        const halfWidth=Math.sqrt(maxRadius**2-dy**2);
        const lonFactor=metersPerDegree*Math.max(.01,Math.cos(sampleLat*Math.PI/180));
        const left=Math.ceil((lon-halfWidth/lonFactor-west)*metersPerDegree*cosBase/step-.5);
        const right=Math.floor((lon+halfWidth/lonFactor-west)*metersPerDegree*cosBase/step-.5);
        for(let x=left;x<=right;x++){
          const dx=(lonAt(x)-lon)*lonFactor,distance=Math.hypot(dx,dy);
          add(x,y,pointVisibility(distance));
        }
      }
    }
    for(const ring of loops){
      const ys=ring.map(p=>p[0]),xs=ring.map(p=>p[1]);
      const polygon=ring.map(([lat,lon])=>[lon,lat]);
      const minX=Math.floor((Math.max(west,Math.min(...xs))-west)*metersPerDegree*cosBase/step);
      const maxX=Math.ceil((Math.min(east,Math.max(...xs))-west)*metersPerDegree*cosBase/step);
      const minY=Math.floor((Math.max(south,Math.min(...ys))-south)*metersPerDegree/step);
      const maxY=Math.ceil((Math.min(north,Math.max(...ys))-south)*metersPerDegree/step);
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
        if(inRing(lonAt(x),latAt(y),polygon))add(x,y,1);
      }
    }
    let revealed=0;
    for(const [key,visibility] of cells){
      const y=Number(key.slice(key.indexOf(',')+1));
      revealed+=visibility*step*step*Math.cos(latAt(y)*Math.PI/180)/cosBase;
    }
    return Math.min(100,100*revealed/feature.area);
  }
  function scheduleProgress(){
    if(!currentCountry)return;
    if(progressTimer&&progressCountry===currentCountry)return;
    clearTimeout(progressTimer);progressCountry=currentCountry;
    progressTimer=setTimeout(()=>{
      progressTimer=null;
      if(!currentCountry)return;
      lastProgressAt=Date.now();
      const value=exploredPercent(currentCountry);
      $('countryProgress').textContent=value===0?'0 %':
        value.toLocaleString(locale,{minimumFractionDigits:5,maximumFractionDigits:5})+' %';
    },Math.max(300,10000-(Date.now()-lastProgressAt)));
  }
  loadCountries();
  $('count').textContent=String(points.length);
  const canvas=document.createElement('canvas');
  canvas.className='fog-canvas';canvas.setAttribute('aria-hidden','true');
  map.getContainer().appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const borderCanvas=document.createElement('canvas');
  borderCanvas.className='border-canvas';borderCanvas.setAttribute('aria-hidden','true');
  map.getContainer().appendChild(borderCanvas);
  const borderCtx=borderCanvas.getContext('2d');
  const coverage=document.createElement('canvas');
  const coverageCtx=coverage.getContext('2d',{willReadFrequently:true});
  const MASK_SIZE=384;
  let radialMask=null;
  function getRadialMask(){
    if(radialMask)return radialMask;
    radialMask=document.createElement('canvas');
    radialMask.width=radialMask.height=MASK_SIZE;
    const c=radialMask.getContext('2d');
    const image=c.createImageData(MASK_SIZE,MASK_SIZE);
    for(let y=0;y<MASK_SIZE;y++)for(let x=0;x<MASK_SIZE;x++){
      const distance=Math.hypot(x+.5-MASK_SIZE/2,y+.5-MASK_SIZE/2)*MAX_RADIUS/(MASK_SIZE/2);
      const value=Math.round(255*pointVisibility(distance));
      const offset=(y*MASK_SIZE+x)*4;
      image.data[offset]=image.data[offset+1]=image.data[offset+2]=value;
      image.data[offset+3]=255;
    }
    c.putImageData(image,0,0);
    return radialMask;
  }
  function draw(){
    queued=false;
    const size=map.getSize(),ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(size.x*ratio)||canvas.height!==Math.round(size.y*ratio)){
      canvas.width=Math.round(size.x*ratio);canvas.height=Math.round(size.y*ratio);
    }
    if(coverage.width!==canvas.width||coverage.height!==canvas.height){
      coverage.width=canvas.width;coverage.height=canvas.height;
    }
    coverageCtx.setTransform(ratio,0,0,ratio,0,0);
    coverageCtx.globalCompositeOperation='source-over';
    coverageCtx.fillStyle='#000';
    coverageCtx.fillRect(0,0,size.x,size.y);
    coverageCtx.globalCompositeOperation='lighten';
    const shape=getRadialMask(),seen=new Set();
    for(const [lat,lon] of points){
      const cos=Math.max(.01,Math.cos(lat*Math.PI/180));
      const bucket=Math.floor(lat*111195/75)+','+Math.floor(lon*111195*cos/75);
      if(seen.has(bucket))continue;
      seen.add(bucket);
      const p=map.latLngToContainerPoint([lat,lon]);
      const north=map.latLngToContainerPoint([lat+1000/111320,lon]);
      const outer=MAX_RADIUS*Math.abs(north.y-p.y)/1000;
      if(outer<.3||p.x+outer<0||p.x-outer>size.x||p.y+outer<0||p.y-outer>size.y)continue;
      coverageCtx.drawImage(shape,p.x-outer,p.y-outer,2*outer,2*outer);
    }
    // A walked, closed ring reveals everything it surrounds, even where
    // individual directional clearings leave fog in the middle.
    coverageCtx.fillStyle='#fff';
    for(const ring of loops){
      coverageCtx.beginPath();
      ring.forEach(([lat,lon],index)=>{
        const p=map.latLngToContainerPoint([lat,lon]);
        if(index===0)coverageCtx.moveTo(p.x,p.y);else coverageCtx.lineTo(p.x,p.y);
      });
      coverageCtx.closePath();coverageCtx.fill();
    }
    const fog=coverageCtx.getImageData(0,0,coverage.width,coverage.height);
    for(let i=0;i<fog.data.length;i+=4){
      const visible=fog.data[i];
      fog.data[i]=5;fog.data[i+1]=10;fog.data[i+2]=12;
      fog.data[i+3]=255-visible;
    }
    ctx.putImageData(fog,0,0);
    drawBorders(size,ratio);
  }
  function drawBorders(size,ratio){
    if(borderCanvas.width!==canvas.width||borderCanvas.height!==canvas.height){
      borderCanvas.width=canvas.width;borderCanvas.height=canvas.height;
    }
    borderCtx.setTransform(ratio,0,0,ratio,0,0);
    borderCtx.clearRect(0,0,size.x,size.y);
    if(!countries.length)return;
    const visible=map.getBounds();
    borderCtx.strokeStyle='#cbd2d2';borderCtx.lineWidth=1.65;
    borderCtx.lineCap='round';borderCtx.lineJoin='round';
    for(const feature of countries){
      const [west,south,east,north]=feature.bounds;
      if(!visible.intersects([[south,west],[north,east]]))continue;
      borderCtx.beginPath();
      for(const polygon of rings(feature))for(const ring of polygon){
        let previous=null;
        for(const [lon,lat] of ring){
          const next=map.latLngToContainerPoint([lat,lon]);
          if(previous&&Math.min(previous.x,next.x)<=size.x+2&&
            Math.max(previous.x,next.x)>=-2&&Math.min(previous.y,next.y)<=size.y+2&&
            Math.max(previous.y,next.y)>=-2){
            borderCtx.moveTo(previous.x,previous.y);
            borderCtx.lineTo(next.x,next.y);
          }
          previous=next;
        }
      }
      borderCtx.stroke();
    }
  }
  function renderWorld(center=false){
    if(!worldActive)return;
    const height=worldView.clientHeight,width=2*height;
    if(height<=0)return;
    const ratio=Math.min(devicePixelRatio||1,2);
    worldCanvas.style.width=width+'px';worldCanvas.style.height=height+'px';
    worldCanvas.width=Math.round(width*ratio);worldCanvas.height=Math.round(height*ratio);
    const c=worldCanvas.getContext('2d');
    c.setTransform(ratio,0,0,ratio,0,0);
    c.fillStyle='#070d11';c.fillRect(0,0,width,height);
    const xy=([lon,lat])=>[(lon+180)/360*width,(90-lat)/180*height];
    c.lineJoin='round';c.lineWidth=1.05;
    for(const feature of countries){
      for(const polygon of rings(feature)){
        c.beginPath();
        for(const ring of polygon){
          ring.forEach((coordinate,index)=>{
            const [x,y]=xy(coordinate);
            if(index===0)c.moveTo(x,y);else c.lineTo(x,y);
          });
          c.closePath();
        }
        c.fillStyle='#1b2729';c.fill('evenodd');
        c.strokeStyle='#cbd2d2';c.stroke();
      }
    }
    // Small markers show visited regions without printing country names.
    c.fillStyle='#db806b';
    for(const [lat,lon] of points){
      const [x,y]=xy([lon,lat]);
      c.beginPath();c.arc(x,y,1.6,0,Math.PI*2);c.fill();
    }
    if(marker){
      const {lat,lng}=marker.getLatLng(),[x,y]=xy([lng,lat]);
      c.beginPath();c.arc(x,y,5,0,Math.PI*2);
      c.fillStyle='#e67c68';c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();
    }
    if(center){
      const lon=marker?marker.getLatLng().lng:23.8813;
      worldView.scrollLeft=(lon+180)/360*width-worldView.clientWidth/2;
    }
  }
  $('worldButton').onclick=()=>{
    $('countryPicker').hidden=true;
    worldActive=!worldActive;
    worldView.hidden=!worldActive;
    document.querySelector('.map-shell').classList.toggle('world-active',worldActive);
    $('worldButton').textContent=worldActive?'↩':'◎';
    $('worldButton').setAttribute('aria-label',t(worldActive?'backToMap':'showWorld'));
    $('worldButton').setAttribute('aria-pressed',String(worldActive));
    $('mapLabel').textContent=t(worldActive?'worldMap':marker?'discovering':'unexplored');
    if(worldActive)renderWorld(true);
    else map.invalidateSize();
  };
  window.addEventListener('resize',()=>{if(worldActive)renderWorld(false);});
  function redraw(){if(!queued){queued=true;requestAnimationFrame(draw);}}
  map.on('move zoom zoomanim zoomend resize viewreset',redraw);redraw();
  function save(lat,lon){
    points.push([lat,lon]);
    if(points.length>MAX_POINTS)points=points.slice(-MAX_POINTS);
    trail.push([lat,lon]);
    if(trail.length>1500)trail.shift();
    detectEnclosure();
    if(importing)return;
    try{localStorage.setItem(KEY,JSON.stringify(points));}
    catch{$('status').textContent=t('noStorage');}
    $('count').textContent=String(points.length);
    redraw();
    if(worldActive)renderWorld();
    scheduleProgress();
  }
  function ringArea(ring){
    const origin=ring[0],cos=Math.cos(origin[0]*Math.PI/180);
    let twice=0;
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      const ax=(a[1]-origin[1])*111320*cos,ay=(a[0]-origin[0])*111320;
      const bx=(b[1]-origin[1])*111320*cos,by=(b[0]-origin[0])*111320;
      twice+=ax*by-bx*ay;
    }
    return Math.abs(twice)/2;
  }
  function detectEnclosure(){
    if(trail.length<7)return;
    const current=trail[trail.length-1];
    for(let i=0;i<=trail.length-7;i++){
      if(map.distance(current,trail[i])>100)continue;
      const ring=trail.slice(i);
      let perimeter=map.distance(current,trail[i]);
      for(let j=1;j<ring.length;j++)perimeter+=map.distance(ring[j-1],ring[j]);
      if(perimeter<450||ringArea(ring)<15000)continue;
      loops.push(ring);
      if(loops.length>MAX_LOOPS)loops.shift();
      try{localStorage.setItem(LOOPS_KEY,JSON.stringify(loops));}
      catch{$('status').textContent=t('noEnclosedStorage');}
      trail=[current];
      return;
    }
  }
  $('radius').textContent='5 km';
  $('terrain').textContent=t('allDirections');
  function onPosition(position,fromNative=false,render=true){
    const {latitude:lat,longitude:lon,accuracy}=position.coords;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return;
    $('accuracy').textContent=Number.isFinite(accuracy)?Math.round(accuracy)+' m':'–';
    if(!Number.isFinite(accuracy)||accuracy>MAX_ACCURACY){
      $('status').textContent=t('locationAccuracyWaiting');return;
    }
    const point=[lat,lon],now=position.timestamp||Date.now();
    const distance=lastFix?map.distance(lastFix.point,point):Infinity;
    const seconds=lastFix?(now-lastFix.time)/1000:Infinity;
    if(lastFix&&seconds>0&&distance/seconds>70){
      $('status').textContent=t('gpsJump');return;
    }
    latestPosition=point;
    discoverFix(lat,lon,now);
    if(render&&!marker){
      marker=L.circleMarker(point,{radius:8,color:'#fff',weight:3,fillColor:'#dd785f',fillOpacity:1}).addTo(map);
      if(followPosition)map.fitBounds(locationBounds(point),{padding:[40,40],animate:false});
    }
    else if(render)marker.setLatLng(point);
    if(render&&followPosition&&!worldActive&&!fromNative&&(!lastFix||distance>=5))
      map.panTo(point,{animate:true,duration:.35});
    if(render&&worldActive&&!fromNative)renderWorld();
    if(render)setCountry({lat,lng:lon});
    if(distance>=10){
      // Short plausible gaps form a corridor; long gaps only reveal endpoints.
      if(lastFix&&distance<=2000&&seconds>0&&seconds<=120){
        const steps=Math.ceil(distance/75);
        for(let i=1;i<steps;i++){
          const t=i/steps;save(lastFix.point[0]+(lat-lastFix.point[0])*t,lastFix.point[1]+(lon-lastFix.point[1])*t);
        }
      }
      save(lat,lon);lastFix={point,time:now};
      $('status').textContent=t('exploringSaved');
    }else $('status').textContent=t('locationWaiting');
    if(render&&!worldActive)$('mapLabel').textContent=t('discovering');
  }
  function stop(){
    if(watcher===-1&&native)native.stopTracking();
    else if(watcher!==null)navigator.geolocation.clearWatch(watcher);
    watcher=null;lastFix=null;latestPosition=null;trail=[];$('start').disabled=false;$('stop').disabled=true;
  }
  let nativeStartAt=0;
  let syncing=false;
  async function syncNative(){
    if(!native||syncing||!bordersReady)return;
    syncing=true;
    try{
      const tracking=native.isTracking();
      if(tracking)nativeStartAt=0;
      if(tracking&&watcher===null){
        watcher=-1;$('start').disabled=true;$('stop').disabled=false;
        $('status').textContent=t('backgroundTracking');
      }else if(!tracking&&watcher===-1&&Date.now()-nativeStartAt>5000){
        watcher=null;lastFix=null;latestPosition=null;trail=[];
        $('start').disabled=false;$('stop').disabled=true;
        $('status').textContent=t('stopped');
      }
      const fixes=JSON.parse(native.pendingFixes());
      if(!Array.isArray(fixes)||!fixes.length)return;
      let acknowledged=0;
      importing=true;
      try{
        for(let i=0;i<fixes.length;i++){
          const fix=fixes[i];
          if(!Number.isFinite(fix.lat)||!Number.isFinite(fix.lon)||!Number.isFinite(fix.time))continue;
          onPosition({coords:{latitude:fix.lat,longitude:fix.lon,accuracy:fix.accuracy},timestamp:fix.time},
            true,i===fixes.length-1);
          acknowledged=fix.id;
        }
      }finally{importing=false;}
      await discovery.flush();
      if(acknowledged){
        try{localStorage.setItem(KEY,JSON.stringify(points));}
        catch{$('status').textContent=t('noStorage');return;}
        $('count').textContent=String(points.length);
        redraw();scheduleProgress();
        if(latestPosition){
          if(marker)marker.setLatLng(latestPosition);
          else marker=L.circleMarker(latestPosition,{radius:8,color:'#fff',weight:3,fillColor:'#dd785f',fillOpacity:1}).addTo(map);
          setCountry({lat:latestPosition[0],lng:latestPosition[1]});
        }
        native.ackFixes(acknowledged);
      }
      if(latestPosition&&followPosition&&!worldActive)
        map.panTo(latestPosition,{animate:false});
      if(worldActive)renderWorld(false);
      if(fixes.length===1000)setTimeout(syncNative,0);
    }catch{ /* Keep the native queue untouched so it can be retried. */ }
    finally{syncing=false;}
  }
  window.ETNSyncNative=syncNative;
  window.ETNTrackingStarted=()=>{$('status').textContent=t('backgroundTracking');syncNative();};
  window.ETNTrackingDenied=()=>{watcher=null;$('start').disabled=false;$('stop').disabled=true;$('status').textContent=t('locationDenied');};
  window.ETNNotificationDenied=()=>{$('status').textContent=t('notificationDenied');};
  if(native){
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncNative();});
    setInterval(syncNative,500);
    syncNative();
  }
  $('start').onclick=()=>{
    if(watcher!==null)return;
    if(native){
      watcher=-1;nativeStartAt=Date.now();
      $('start').disabled=true;$('stop').disabled=false;
      $('status').textContent=t('waitingGps');
      try{native.startTracking();}catch{window.ETNTrackingDenied();}
      return;
    }
    if(!navigator.geolocation){$('status').textContent=t('unsupportedGps');return;}
    watcher=navigator.geolocation.watchPosition(onPosition,error=>{
      $('status').textContent=t(error.code===1?'locationDenied':'locationFailed');
      stop();
    },{enableHighAccuracy:true,maximumAge:0,timeout:20000});
    $('start').disabled=true;$('stop').disabled=false;
    $('status').textContent=t('waitingGps');
  };
  $('stop').onclick=()=>{stop();$('status').textContent=t('stopped');};
  $('recenter').onclick=()=>{if(marker){setFollowPosition(true);$('countryPicker').hidden=true;if(worldActive)renderWorld(true);else map.fitBounds(locationBounds(marker.getLatLng()),overviewOptions);}else $('status').textContent=t('noLocation');};
})();
