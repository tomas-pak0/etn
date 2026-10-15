/* Geographic fog snapshots. Shared by the rendering worker and its fallback. */
(function(root){
  'use strict';
  const EARTH=40030228.884,rad=Math.PI/180;
  function mercator(lat,lon){const p=Math.max(-85.05112878,Math.min(85.05112878,lat))*rad;return[(lon+180)/360,(1-Math.asinh(Math.tan(p))/Math.PI)/2];}
  function latitude(y){return Math.atan(Math.sinh(Math.PI*(1-2*y)))/rad;}
  const wrap=x=>x-Math.round(x);
  function project(view,x,y){const dx=wrap(x-view.origin[0]),dy=y-view.origin[1];return[view.a*dx+view.c*dy+view.e,view.b*dx+view.d*dy+view.f];}
  function inverse(view,x,y){const det=view.a*view.d-view.b*view.c,px=x-view.e,py=y-view.f;return[view.origin[0]+(view.d*px-view.c*py)/det,view.origin[1]+(-view.b*px+view.a*py)/det];}
  function transform(from,to){
    const det=from.a*from.d-from.b*from.c;
    const a=(to.a*from.d-to.c*from.b)/det,b=(to.b*from.d-to.d*from.b)/det;
    const c=(-to.a*from.c+to.c*from.a)/det,d=(-to.b*from.c+to.d*from.a)/det;
    const dx=wrap(from.origin[0]-to.origin[0]),dy=from.origin[1]-to.origin[1];
    return{a,b,c,d,e:to.e+to.a*dx+to.c*dy-a*from.e-c*from.f,f:to.f+to.b*dx+to.d*dy-b*from.e-d*from.f};
  }
  function createScene(maxRadius=5000,clearRadius=500){
    const bins=new Map(),loops=[];let countries=[],field=null,fieldCanvas=null;
    const scale=512,key=(x,y)=>((x%scale+scale)%scale)+','+y;
    const visibility=d=>d<=clearRadius?1:d>=maxRadius?0:(maxRadius-d)/(maxRadius-clearRadius);
    function add(points){for(const [lat,lon] of points){const [x,y]=mercator(lat,lon),k=key(Math.floor(x*scale),Math.floor(y*scale));let bin=bins.get(k);if(!bin)bins.set(k,bin=[]);bin.push({x,y,lat});}}
    function candidates(view,width,height){
      const corners=[[0,0],[width,0],[0,height],[width,height]].map(p=>inverse(view,...p));
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      const margin=maxRadius/(EARTH*Math.max(.01,Math.cos(Math.max(...ys.map(y=>Math.abs(latitude(y))))*rad)));
      const west=Math.floor((Math.min(...xs)-margin)*scale),east=Math.floor((Math.max(...xs)+margin)*scale);
      const north=Math.floor((Math.min(...ys)-margin)*scale),south=Math.floor((Math.max(...ys)+margin)*scale);
      const found=[];
      if((east-west+1)*(south-north+1)>bins.size*2){
        for(const [k,bin] of bins){const [x,y]=k.split(',').map(Number);const shift=Math.round(view.origin[0]-x/scale)*scale;
          if(y>=north&&y<=south&&x+shift>=west&&x+shift<=east)for(const point of bin)found.push(point);}
      }else for(let y=north;y<=south;y++)for(let x=west;x<=east;x++){const bin=bins.get(key(x,y));if(bin)for(const point of bin)found.push(point);}
      return found;
    }
    function paint(canvas,view,width,height,makeCanvas){
      if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
      const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,width,height);
      const pixelsPerWorld=Math.hypot(view.a,view.b),visible=[];let outer=1;
      for(const point of candidates(view,width,height)){
        const [x,y]=project(view,point.x,point.y),radius=maxRadius/(EARTH*Math.max(.01,Math.cos(point.lat*rad)))*pixelsPerWorld;
        if(x+radius<0||x-radius>width||y+radius<0||y-radius>height)continue;
        outer=Math.max(outer,radius);visible.push([x,y]);
      }
      if(!visible.length){ctx.fillStyle='#000';ctx.fillRect(0,0,width,height);}
      else{
        // Max visibility is a nearest-distance field. Its cost is bounded by
        // the bitmap size rather than thousands of overlapping radial blits.
        // The old 384px radial texture also sampled the gradient; this grid
        // retains that soft rendering while handling dense histories cheaply.
        const scale=Math.min(1,1000/(Math.max(width,height)+2*outer+4));
        const pad=Math.ceil(outer*scale)+2,w=Math.ceil(width*scale),h=Math.ceil(height*scale),fw=w+2*pad,fh=h+2*pad,length=fw*fh;
        if(!field||field.length<length)field=new Float64Array(length);
        field.fill(1e12,0,length);
        for(const [x,y] of visible){const px=Math.floor(x*scale)+pad,py=Math.floor(y*scale)+pad;if(px>=0&&px<fw&&py>=0&&py<fh)field[py*fw+px]=0;}
        // Horizontal nearest seeds, then exact squared-distance envelopes in
        // each column. No visibility contour or enclosed-region detection.
        for(let y=0;y<fh;y++){
          const row=y*fw;let seed=-1e6;
          for(let x=0;x<fw;x++){if(field[row+x]===0)seed=x;else field[row+x]=(x-seed)**2;}
          seed=1e6;for(let x=fw-1;x>=0;x--){if(field[row+x]===0)seed=x;else field[row+x]=Math.min(field[row+x],(x-seed)**2);}
        }
        const f=new Float64Array(fh),v=new Int32Array(fh),z=new Float64Array(fh+1);
        for(let x=0;x<fw;x++){
          for(let y=0;y<fh;y++)f[y]=field[y*fw+x];
          let k=0;v[0]=0;z[0]=-Infinity;z[1]=Infinity;
          for(let q=1;q<fh;q++){
            let intersection=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*(q-v[k]));
            while(intersection<=z[k]){k--;intersection=((f[q]+q*q)-(f[v[k]]+v[k]*v[k]))/(2*(q-v[k]));}
            k++;v[k]=q;z[k]=intersection;z[k+1]=Infinity;
          }
          k=0;for(let q=0;q<fh;q++){while(z[k+1]<q)k++;field[q*fw+x]=(q-v[k])**2+f[v[k]];}
        }
        fieldCanvas??=makeCanvas(w,h);fieldCanvas.width=w;fieldCanvas.height=h;
        const fc=fieldCanvas.getContext('2d'),image=fc.createImageData(w,h),det=view.a*view.d-view.b*view.c;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const worldY=view.origin[1]+(-view.b*((x+.5)/scale-view.e)+view.a*((y+.5)/scale-view.f))/det;
          const metersPerPixel=EARTH/(pixelsPerWorld*scale*Math.cosh(Math.PI*(1-2*worldY)));
          const alpha=Math.round(255*(1-visibility(Math.sqrt(field[(y+pad)*fw+x+pad])*metersPerPixel)));
          image.data[(y*w+x)*4+3]=alpha;
        }
        fc.putImageData(image,0,0);ctx.drawImage(fieldCanvas,0,0,w,h,0,0,width,height);
      }
      // Only saved, explicitly walked closed routes reveal their interiors.
      ctx.globalCompositeOperation='destination-out';ctx.fillStyle='#fff';
      for(const ring of loops){ctx.beginPath();ring.forEach(([lat,lon],i)=>{const p=project(view,...mercator(lat,lon));if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.fill();}
      ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='#cbd2d2';ctx.lineWidth=1.65;ctx.lineCap='round';ctx.lineJoin='round';
      for(const feature of countries){
        ctx.beginPath();const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
        for(const polygon of polygons)for(const ring of polygon){let previous=null;
          for(const [lon,lat] of ring){const p=project(view,...mercator(lat,lon));
            if(previous&&Math.abs(previous[0]-p[0])<Math.hypot(view.a,view.b)/2&&Math.min(previous[0],p[0])<=width+2&&Math.max(previous[0],p[0])>=-2&&Math.min(previous[1],p[1])<=height+2&&Math.max(previous[1],p[1])>=-2){ctx.moveTo(...previous);ctx.lineTo(...p);}previous=p;}
        }ctx.stroke();
      }
      return{drawn:visible.length};
    }
    return{add,addLoops:rings=>loops.push(...rings),countries:value=>{countries=value;},paint,candidates,visibility};
  }
  const api={mercator,latitude,project,inverse,transform,createScene};
  if(typeof module==='object')module.exports=api;else root.ETNFogCore=api;
})(typeof self==='object'?self:globalThis);
