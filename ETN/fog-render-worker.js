/* Pixel work stays off the map's animation thread. */
'use strict';
importScripts('fog-core.js');
let scene,canvas;
self.onmessage=event=>{
  const data=event.data;
  try{
    if(data.type==='init'){scene=ETNFogCore.createScene(data.maxRadius,data.clearRadius);return;}
    if(data.type==='points'){scene.add(data.points);return;}
    if(data.type==='loops'){scene.addLoops(data.loops);return;}
    if(data.type==='countries'){scene.countries(data.countries);return;}
    if(data.type==='paint'){
      if(typeof OffscreenCanvas!=='function')throw Error('Offscreen canvas unavailable');
      const make=(w,h)=>new OffscreenCanvas(w,h);canvas??=make(data.width,data.height);
      const start=performance.now(),stats=scene.paint(canvas,data.view,data.width,data.height,make);
      const bitmap=canvas.transferToImageBitmap();
      self.postMessage({id:data.id,view:data.view,width:data.width,height:data.height,bitmap,stats:{...stats,milliseconds:performance.now()-start}},[bitmap]);
    }
  }catch(error){self.postMessage({error:String(error.message||error)});}
};
