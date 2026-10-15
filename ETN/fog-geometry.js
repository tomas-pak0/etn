/* Geographic hole detection at the 50% visibility contour; no viewport pixels. */
((root)=>{
  'use strict';
  const METERS=111195,STEP=250,RADIUS=2750;
  function create(){
    let origin=null,cos=1;
    const cells=new Set(),samples=new Set();
    const key=(x,y)=>x+','+y;
    const unwrap=lon=>origin+((lon-origin+540)%360)-180;
    function add(points){
      for(const p of points){
        const [lat,lon]=p;
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)continue;
        if(origin===null){origin=lon;cos=Math.max(.05,Math.cos(lat*Math.PI/180));}
        const x=unwrap(lon)*METERS*cos/STEP,y=lat*METERS/STEP;
        const sample=key(Math.round(x*2),Math.round(y*2));
        if(samples.has(sample))continue;
        samples.add(sample);
        const rx=RADIUS/STEP*cos/Math.max(.05,Math.cos(lat*Math.PI/180)),ry=RADIUS/STEP;
        for(let gy=Math.ceil(y-ry);gy<=Math.floor(y+ry);gy++){
          const reach=rx*Math.sqrt(Math.max(0,1-((gy-y)/ry)**2));
          for(let gx=Math.ceil(x-reach);gx<=Math.floor(x+reach);gx++)cells.add(key(gx,gy));
        }
      }
    }
    function holes(){
      const edges=new Map();
      const edge=(x,y,a,b)=>{const k=key(x,y);if(!edges.has(k))edges.set(k,[]);edges.get(k).push([a,b]);};
      for(const cell of cells){
        const [x,y]=cell.split(',').map(Number);
        if(!cells.has(key(x,y-1)))edge(x,y,x+1,y);
        if(!cells.has(key(x+1,y)))edge(x+1,y,x+1,y+1);
        if(!cells.has(key(x,y+1)))edge(x+1,y+1,x,y+1);
        if(!cells.has(key(x-1,y)))edge(x,y+1,x,y);
      }
      const output=[];
      while(edges.size){
        const start=edges.keys().next().value;
        let at=start,previous=null,ring=[],closed=false;
        while(edges.has(at)){
          const current=at.split(',').map(Number),options=edges.get(at);
          let index=0;
          if(options.length>1&&previous){
            const dx=current[0]-previous[0],dy=current[1]-previous[1];
            // At touching corners, keep occupied cells on the left.
            let best=-Infinity;
            options.forEach((p,i)=>{const a=Math.atan2(dx*(p[1]-current[1])-dy*(p[0]-current[0]),dx*(p[0]-current[0])+dy*(p[1]-current[1]));if(a>best){best=a;index=i;}});
          }
          const next=options.splice(index,1)[0];
          if(!options.length)edges.delete(at);
          ring.push(current);previous=current;at=key(...next);
          if(at===start){closed=true;break;}
        }
        if(!closed||ring.length<4)continue;
        let area=0;
        for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];area+=a[0]*b[1]-b[0]*a[1];}
        if(area>=0)continue;
        // Remove only collinear vertices; retain the whole geographic contour.
        ring=ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];return(p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
        output.push(ring.map(([x,y])=>[y*STEP/METERS,((x*STEP/(METERS*cos)+540)%360)-180]));
      }
      return output;
    }
    return{add,holes};
  }
  root.ETNFogGeometry={create};
})(typeof self==='undefined'?globalThis:self);
