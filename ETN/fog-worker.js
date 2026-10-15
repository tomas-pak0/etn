importScripts('fog-geometry.js');
const geometry=ETNFogGeometry.create();
let timer=null;
onmessage=event=>{
  geometry.add(event.data.points||[]);
  if(!timer)timer=setTimeout(()=>{timer=null;postMessage({holes:geometry.holes()});},event.data.initial?0:1200);
};
