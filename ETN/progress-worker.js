/* Incremental country coverage, isolated from camera and fog rendering. */
'use strict';
let countries=[],points=[],loops=[],maxRadius=5000,clearRadius=500;
const caches=new Map(),results=new Map(),versions=new Map(),meters=111195;
const polygons=feature=>feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
function inRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function inside(lon,lat,feature){const [w,s,e,n]=feature.bounds;return lon>=w&&lon<=e&&lat>=s&&lat<=n&&polygons(feature).some(p=>inRing(lon,lat,p[0])&&!p.slice(1).some(r=>inRing(lon,lat,r)));}
function near([lat,lon],feature){const [w,s,e,n]=feature.bounds,r=maxRadius/meters,dx=r/Math.max(.01,Math.cos(lat*Math.PI/180));return lat+r>=s&&lat-r<=n&&lon+dx>=w&&lon-dx<=e;}
function touch(batch){for(const f of countries)if(batch.some(p=>near(p,f)))versions.set(f.properties.code,(versions.get(f.properties.code)||0)+1);}
function calculate(feature){
  const code=feature.properties.code,version=versions.get(code)||0,result=results.get(code);
  if(result&&result.version===version)return result.value;
  let cache=caches.get(code);
  if(!cache){cache={processed:0,rings:0,seen:new Set(),cells:new Map(),membership:new Map(),revealed:0};}
  caches.delete(code);caches.set(code,cache);
  // Keep detailed grids for two recently requested countries; retain scalar
  // results for every country. This bounds long-trip working memory.
  while(caches.size>2)caches.delete(caches.keys().next().value);
  const [west,south,east,north]=feature.bounds,cosBase=Math.max(.01,Math.cos((south+north)/2*Math.PI/180)),step=500;
  const latAt=y=>south+(y+.5)*step/meters,lonAt=x=>west+(x+.5)*step/(meters*cosBase);
  function add(x,y,visibility){
    if(visibility<=0)return;const key=x+','+y,previous=cache.cells.get(key)||0;if(visibility<=previous)return;
    let member=cache.membership.get(key);
    if(member===undefined){member=inside(lonAt(x),latAt(y),feature);cache.membership.set(key,member);}
    if(!member)return;cache.cells.set(key,visibility);
    cache.revealed+=(visibility-previous)*step*step*Math.cos(latAt(y)*Math.PI/180)/cosBase;
  }
  for(let index=cache.processed;index<points.length;index++){
    const [lat,lon]=points[index];if(!near(points[index],feature))continue;
    const bucket=Math.floor(lat*1112)+','+Math.floor(lon*1112*cosBase);if(cache.seen.has(bucket))continue;cache.seen.add(bucket);
    const cy=(lat-south)*meters/step-.5,reach=Math.ceil(maxRadius/step)+1;
    for(let y=Math.floor(cy-reach);y<=Math.ceil(cy+reach);y++){
      const sampleLat=latAt(y),dy=(sampleLat-lat)*meters;if(Math.abs(dy)>=maxRadius)continue;
      const halfWidth=Math.sqrt(maxRadius**2-dy**2),lonFactor=meters*Math.max(.01,Math.cos(sampleLat*Math.PI/180));
      const left=Math.ceil((lon-halfWidth/lonFactor-west)*meters*cosBase/step-.5),right=Math.floor((lon+halfWidth/lonFactor-west)*meters*cosBase/step-.5);
      for(let x=left;x<=right;x++){const distance=Math.hypot((lonAt(x)-lon)*lonFactor,dy);add(x,y,distance<=clearRadius?1:Math.max(0,(maxRadius-distance)/(maxRadius-clearRadius)));}
    }
  }
  cache.processed=points.length;
  for(let index=cache.rings;index<loops.length;index++){
    const ring=loops[index],ys=ring.map(p=>p[0]),xs=ring.map(p=>p[1]),polygon=ring.map(([lat,lon])=>[lon,lat]);
    const minX=Math.floor((Math.max(west,Math.min(...xs))-west)*meters*cosBase/step),maxX=Math.ceil((Math.min(east,Math.max(...xs))-west)*meters*cosBase/step);
    const minY=Math.floor((Math.max(south,Math.min(...ys))-south)*meters/step),maxY=Math.ceil((Math.min(north,Math.max(...ys))-south)*meters/step);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(inRing(lonAt(x),latAt(y),polygon))add(x,y,1);
  }
  cache.rings=loops.length;const value=Math.min(100,100*cache.revealed/feature.area);results.set(code,{value,version});return value;
}
self.onmessage=event=>{
  const data=event.data;
  if(data.type==='init'){maxRadius=data.maxRadius;clearRadius=data.clearRadius;return;}
  if(data.type==='countries'){countries=data.countries;touch(points);for(const ring of loops)touch(ring);return;}
  if(data.type==='points'){for(const point of data.points)points.push(point);touch(data.points);return;}
  if(data.type==='loops'){for(const ring of data.loops){loops.push(ring);touch(ring);}return;}
  if(data.type==='calculate'){
    try{const selected=data.codes?countries.filter(f=>data.codes.includes(f.properties.code)):countries.filter(f=>versions.has(f.properties.code));
      const values={};for(const feature of selected)values[feature.properties.code]=calculate(feature);self.postMessage({id:data.id,values});
    }catch{self.postMessage({id:data.id,values:{}});}
  }
};
