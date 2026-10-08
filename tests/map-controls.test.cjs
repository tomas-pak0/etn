const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'ETN/heading.js'),'utf8'),context);
const {create,bearing}=context.window.ETNHeading;
const distance=(a,b)=>{
  const r=Math.PI/180,dl=(b[0]-a[0])*r,dn=(b[1]-a[1])*r;
  return 6371008.8*2*Math.asin(Math.sqrt(Math.sin(dl/2)**2+
    Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dn/2)**2));
};
const fix=(overrides={})=>({latitude:55,longitude:24,accuracy:5,...overrides});
let course=create(distance);
assert.equal(course.update(fix({heading:90,speed:3,headingAccuracy:8}),1000),90);
assert.equal(course.update(fix({heading:230,speed:0}),2000),90,'stationary jitter must not rotate the map');
assert.equal(course.update(fix({heading:360,speed:3}),3000),0,'north includes the 360-degree course');
assert.equal(course.update(fix({heading:240,speed:3,headingAccuracy:60}),4000),0,'unreliable native course is ignored');
assert.equal(course.update(fix({heading:45,speed:3,accuracy:200}),5000),0,'poor location cannot rotate the map');
assert.equal(course.update(fix({heading:160,speed:3}),2000),0,'older queued fixes cannot change direction');
course=create(distance);
assert.equal(course.update(fix(),1000),null);
assert.equal(course.update(fix({longitude:24.0006}),11000)>89,true,'legacy fixes infer an eastward course');
const inferred=course.value;
assert.equal(course.update(fix({longitude:24.00061}),12000),inferred,'minor positional noise retains course');
course.reset();
assert.equal(course.update(fix({latitude:56,longitude:25}),500000),inferred,'a restarted trip does not infer a direction across a long gap');
course=create(distance);
course.update(fix({accuracy:70}),1000);
assert.equal(course.update(fix({longitude:24.0003,accuracy:70}),2000),null,'inaccurate drift is not movement');
assert.ok(Math.abs(bearing([55,24],[55.01,24]))<.01);
assert.ok(Math.abs(bearing([55,24],[55,24.01])-90)<.01);
assert.ok(Math.abs(bearing([0,179.99],[0,-179.99])-90)<.01,'course crosses the date line');

// Exercise vector camera and imagery against a controlled renderer. In
// particular, heading animation must not interrupt position interpolation.
const frames=[],handlers={},layout=[],paint=[],cameraViews=[];
let clock=0,center={lng:24,lat:55},zoom=10,currentBearing=359;
const nodes={map:{clientWidth:390,clientHeight:360,replaceChildren(){}},mapNotice:{hidden:true}};
const latLng=p=>Array.isArray(p)?{lat:p[0],lng:p[1]}:p;
const bounds=p=>Array.isArray(p)?{
  getWest:()=>p[0][1],getSouth:()=>p[0][0],getEast:()=>p[1][1],getNorth:()=>p[1][0]
}:p;
class Renderer{
  constructor(){this.touchZoomRotate={disableRotation(){}};this.keyboard={disableRotation(){}};}
  on(name,handler){(handlers[name]??=[]).push(handler);}
  addControl(){}
  getContainer(){return nodes.map;}
  getCenter(){return center;}
  getZoom(){return zoom;}
  getBearing(){return currentBearing;}
  jumpTo(view){cameraViews.push(view);if(view.center)center={lng:view.center[0]??view.center.lng,lat:view.center[1]??view.center.lat};if(view.zoom!==undefined)zoom=view.zoom;if(view.bearing!==undefined)currentBearing=view.bearing;}
  getStyle(){return{layers:[{id:'land',type:'fill'},{id:'town',type:'symbol',layout:{'text-field':['get','name'],'symbol-placement':'line'}}]};}
  getPaintProperty(){return undefined;}
  setLayoutProperty(...args){layout.push(args);}
  setPaintProperty(...args){paint.push(args);}
  addSource(){}
  addLayer(){}
  cameraForBounds(){return{center:[25,56],zoom:12,bearing:currentBearing};}
  resize(){}
}
const mapContext={window:{ETNI18n:{t:key=>key,locale:'lt'}},document:{getElementById:id=>nodes[id]},
  L:{latLng,latLngBounds:bounds,CRS:{Earth:{distance}}},
  maplibregl:{Map:Renderer,NavigationControl:class{},AttributionControl:class{},LngLat:{convert:p=>Array.isArray(p)?{lng:p[0],lat:p[1]}:p}},
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},performance:{now:()=>clock}};
mapContext.window.maplibregl=mapContext.maplibregl;
vm.runInNewContext(fs.readFileSync(path.join(root,'ETN/map-engine.js'),'utf8'),mapContext);
const map=mapContext.window.ETNMap.create('map');
map.setPhoto(true);
for(const fn of handlers['style.load'])fn();
assert.ok(layout.some(x=>x[0]==='etn-photo'&&x[1]==='visibility'&&x[2]==='visible'),'photo preference survives late style loading');
assert.ok(layout.some(x=>x[0]==='town'&&x[1]==='text-rotation-alignment'&&x[2]==='viewport'),'labels stay upright');
map.setPhoto(false);
assert.equal(layout.at(-1)[2],'none');
map.setHeading(1);
map.panTo([55.01,24.01],{duration:.35});
for(let i=0;frames.length&&i<300;i++){clock+=16;frames.shift()(clock);}
assert.ok(Math.abs(center.lat-55.01)<1e-8&&Math.abs(center.lng-24.01)<1e-8,'pan reaches its destination during heading animation');
assert.ok(Math.abs(currentBearing-1)<.01);
assert.ok(cameraViews.filter(x=>x.bearing!==undefined).every(x=>(x.bearing>=359&&x.bearing<=361)||x.bearing===1),'heading crosses north using the shortest turn');
map.fitBounds([[55,24],[57,26]],{padding:[40,40]});
for(let i=0;frames.length&&i<300;i++){clock+=16;frames.shift()(clock);}
assert.equal(center.lng,25);assert.equal(center.lat,56);assert.equal(zoom,12);

let rasterBearing=270,photoLayer=null,photoAdded=false;
const leaflet={setView(){return this;},on(){},getBearing:()=>rasterBearing,
  setBearing:value=>{rasterBearing=value;},hasLayer:()=>photoAdded,removeLayer:()=>{photoAdded=false;}};
const originalBearing=leaflet.getBearing;
mapContext.window.maplibregl=null;
mapContext.L.map=()=>leaflet;
mapContext.L.control={zoom:()=>({addTo(){}})};
mapContext.L.tileLayer=()=>{const layer={addTo(){photoAdded=true;return this;},bringToFront(){}};photoLayer=layer;return layer;};
const fallback=mapContext.window.ETNMap.create('map');
assert.equal(fallback.engine,'raster');assert.equal(fallback.getBearing(),90);
assert.equal(leaflet.getBearing,originalBearing,'the fallback must preserve its rotation plugin API');
fallback.setPhoto(true);assert.equal(photoAdded,true);fallback.setPhoto(false);assert.equal(photoAdded,false);
fallback.setHeading(0);
for(let i=0;frames.length&&i<300;i++){clock+=16;frames.shift()(clock);}
assert.equal(fallback.getBearing(),0);

// All ten current languages must supply meaningful accessible controls.
const ids=new Map();
const node=id=>{if(!ids.has(id))ids.set(id,{textContent:'',dataset:{},setAttribute(){},addEventListener(){}});return ids.get(id);};
const i18nContext={window:{},localStorage:{getItem:()=>null},navigator:{language:'lt'},
  document:{documentElement:{},getElementById:node,querySelectorAll:()=>[]}};
vm.runInNewContext(fs.readFileSync(path.join(root,'ETN/i18n.js'),'utf8'),i18nContext);
for(const [language,dictionary] of Object.entries(i18nContext.window.ETNI18n.dictionaries)){
  for(const key of ['enablePhoto','disablePhoto','northUp','headingUp','switchNorthUp','switchHeadingUp','mapUnavailable'])
    assert.ok(dictionary[key]&&dictionary[key]!==key,language+' missing '+key);
}
console.log('Movement, stationary noise, legacy fixes, north crossing, concurrent camera, imagery, upright labels and ten languages passed.');
