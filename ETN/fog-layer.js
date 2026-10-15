/* A geographic snapshot follows the camera using a single compositor transform. */
(() => {
  'use strict';
  const core=window.ETNFogCore;
  function create(map,maxRadius,clearRadius){
    const canvas=document.createElement('canvas');canvas.className='fog-canvas fog-snapshot';canvas.setAttribute('aria-hidden','true');
    canvas.style.background='#000';map.getContainer().appendChild(canvas);
    const gap=document.createElementNS('http://www.w3.org/2000/svg','svg'),gapPath=document.createElementNS('http://www.w3.org/2000/svg','path');
    gap.classList.add('fog-gap');gap.setAttribute('aria-hidden','true');gapPath.setAttribute('fill','#000');gapPath.setAttribute('fill-rule','evenodd');gap.appendChild(gapPath);map.getContainer().appendChild(gap);
    const ctx=canvas.getContext('2d');let worker=null,fallback=null,snapshot=null,job=null,dirty=true,timer=null,frame=null,sequence=0,booting=true;
    const history={points:[],loops:[],countries:[]},stats={paints:0,transforms:0,worker:false,lastPaintMs:0,visibleSamples:0};
    const visible=()=>!document.hidden&&map.getSize().x>0&&map.getSize().y>0;
    function view(){
      const center=map.getCenter(),origin=core.mercator(center.lat,center.lng);
      const p=map.latLngToContainerPoint(center),east=map.latLngToContainerPoint([center.lat,center.lng+.01]);
      const otherLat=center.lat>84?center.lat-.01:center.lat+.01,north=map.latLngToContainerPoint([otherLat,center.lng]);
      const dx=.01/360,dy=core.mercator(otherLat,center.lng)[1]-origin[1];
      return{origin,a:(east.x-p.x)/dx,b:(east.y-p.y)/dx,c:(north.x-p.x)/dy,d:(north.y-p.y)/dy,e:p.x,f:p.y};
    }
    function apply(){
      frame=null;if(!visible())return;
      if(!snapshot){const size=map.getSize();gapPath.setAttribute('d',`M0 0H${size.x}V${size.y}H0Z`);schedule(0);return;}
      const current=view(),matrix=core.transform(snapshot.view,current);stats.transforms++;
      canvas.style.transform=`matrix(${matrix.a},${matrix.b},${matrix.c},${matrix.d},${matrix.e},${matrix.f})`;
      const size=map.getSize(),det=matrix.a*matrix.d-matrix.b*matrix.c;
      const uncovered=[[0,0],[size.x,0],[0,size.y],[size.x,size.y]].some(([x,y])=>{const u=(matrix.d*(x-matrix.e)-matrix.c*(y-matrix.f))/det,v=(-matrix.b*(x-matrix.e)+matrix.a*(y-matrix.f))/det;return u<20||v<20||u>snapshot.width-20||v>snapshot.height-20;});
      // A fast pan/large zoom can outrun the padded bitmap. Cover only its
      // exterior until the worker returns; unexplored map must never flash.
      const corners=[[0,0],[snapshot.width,0],[snapshot.width,snapshot.height],[0,snapshot.height]].map(([x,y])=>[matrix.a*x+matrix.c*y+matrix.e,matrix.b*x+matrix.d*y+matrix.f]);
      const path=uncovered?`M0 0H${size.x}V${size.y}H0Z M${corners.map(p=>p.join(' ')).join('L')}Z`:'';
      if(gapPath.getAttribute('d')!==path)gapPath.setAttribute('d',path);
      const scale=Math.hypot(matrix.a,matrix.b);
      if(uncovered||scale>1.35||scale<.74){dirty=true;schedule(100);}
    }
    function redraw(){if(!frame&&visible())frame=requestAnimationFrame(apply);}
    function schedule(delay=250){if(timer||job||booting||!visible())return;timer=setTimeout(paint,delay);}
    function paint(){
      timer=null;if(job||!visible())return;if(!dirty&&snapshot)return;
      const size=map.getSize();
      // Soft fog does not need device-pixel-ratio rasterization. Padding covers
      // all rotations and lets normal pans reuse the same bitmap.
      const side=Math.ceil(Math.hypot(size.x,size.y)*1.4),v=view();v.e+=(side-size.x)/2;v.f+=(side-size.y)/2;
      job={type:'paint',id:++sequence,view:v,width:side,height:side};dirty=false;
      if(worker)worker.postMessage(job);
      else{
        const run=()=>{const start=performance.now(),result=fallback.paint(canvas,v,side,side,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});finish({...job,stats:{...result,milliseconds:performance.now()-start}});};
        if(window.requestIdleCallback)requestIdleCallback(run,{timeout:1000});else setTimeout(run,0);
      }
    }
    function finish(data){
      if(data.bitmap){canvas.width=data.width;canvas.height=data.height;ctx.drawImage(data.bitmap,0,0);data.bitmap.close();}
      canvas.style.background='transparent';canvas.style.width=data.width+'px';canvas.style.height=data.height+'px';
      snapshot={view:data.view,width:data.width,height:data.height};job=null;stats.paints++;stats.lastPaintMs=data.stats.milliseconds;stats.visibleSamples=data.stats.drawn;
      apply();if(dirty)schedule();
    }
    function useFallback(error){
      if(worker)worker.terminate();worker=null;stats.worker=false;job=null;
      booting=false;stats.error=error?.message||'Worker unavailable';
      fallback=core.createScene(maxRadius,clearRadius);fallback.add(history.points);fallback.addLoops(history.loops);fallback.countries(history.countries);dirty=true;schedule(0);
    }
    window.ETNWorkers.open('fog-render-worker.js',['fog-core.js']).then(created=>{
      worker=created;stats.worker=true;
      worker.onmessage=event=>{if(event.data.error){useFallback(Error(event.data.error));return;}finish(event.data);};worker.onerror=useFallback;
      worker.postMessage({type:'init',maxRadius,clearRadius});
      worker.postMessage({type:'points',points:history.points});worker.postMessage({type:'loops',loops:history.loops});worker.postMessage({type:'countries',countries:history.countries});
      booting=false;schedule(0);
    }).catch(useFallback);
    function add(type,value){
      if(type==='countries')history.countries=value;else for(const item of value)history[type].push(item);
      if(worker)worker.postMessage({type,[type]:value});
      else if(!booting){if(type==='points')fallback.add(value);else if(type==='loops')fallback.addLoops(value);else fallback.countries(value);}
      dirty=true;schedule();
    }
    map.on('move zoom rotate',redraw);
    map.on('resize',()=>{dirty=true;redraw();schedule(0);});
    document.addEventListener('visibilitychange',()=>{if(visible()){redraw();schedule(0);}});
    redraw();
    return{add:points=>add('points',points),loops:rings=>add('loops',rings),countries:value=>add('countries',value),redraw,stats};
  }
  window.ETNFogLayer={create};
})();
