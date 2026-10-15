const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../ETN/fog-core.js');
// A pixel surface makes geographic/alpha regressions executable in plain Node.
// Android additionally exercises the real OffscreenCanvas rendering worker.
class Surface{
 constructor(w,h){this.width=w;this.height=h;this.ctx=new Pixels(this);}
 getContext(){return this.ctx;}
}
class Pixels{
 constructor(canvas){this.canvas=canvas;this.path=[];}
 reset(){const {width:w,height:h}=this.canvas;if(!this.data||this.data.length!==w*h*4)this.data=new Uint8ClampedArray(w*h*4);}
 setTransform(){}
 clearRect(){this.reset();this.data.fill(0);}
 fillRect(){this.reset();for(let i=3;i<this.data.length;i+=4)this.data[i]=255;}
 createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4),width:w,height:h};}
 putImageData(image){this.data=new Uint8ClampedArray(image.data);}
 drawImage(source,sx,sy,sw,sh,dx,dy,dw,dh){
  this.reset();const input=source.getContext().data,w=this.canvas.width;
  for(let y=0;y<dh;y++)for(let x=0;x<dw;x++){
   const from=(Math.min(sh-1,Math.floor(y/dh*sh))*source.width+Math.min(sw-1,Math.floor(x/dw*sw)))*4;
   this.data[((dy+y)*w+dx+x)*4+3]=input[from+3];
  }
 }
 beginPath(){this.path=[];}moveTo(x,y){this.path.push([x,y]);}lineTo(x,y){this.path.push([x,y]);}closePath(){}stroke(){}
 fill(){
  if(this.globalCompositeOperation!=='destination-out')return;
  const ring=this.path;
  for(let y=0;y<this.canvas.height;y++)for(let x=0;x<this.canvas.width;x++){
   let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}
   if(inside)this.data[(y*this.canvas.width+x)*4+3]=0;
  }
 }
}
const make=(w,h)=>new Surface(w,h),width=400,EARTH=40030228.884;
const view={origin:core.mercator(55,24),a:EARTH*Math.cos(55*Math.PI/180)/25,b:0,c:0,d:EARTH*Math.cos(55*Math.PI/180)/25,e:200,f:200};
const render=scene=>{const c=make(width,width);scene.paint(c,view,width,width,make);return(x,y)=>c.ctx.data[(y*width+x)*4+3];};
let scene=core.createScene();scene.add([[55,24]]);let alpha=render(scene);
assert.equal(alpha(200,200),0,'500 m core is clear');
assert.ok(Math.abs(alpha(310,200)-128)<5,'half visibility stays translucent');
assert.equal(alpha(399,399),255,'unvisited distance remains black');
scene.add([[55,24]]);assert.equal(render(scene)(310,200),alpha(310,200),'overlap uses maximum visibility, not additive clearing');
const route=[];for(let angle=0;angle<360;angle+=2){const a=angle*Math.PI/180;route.push([55+8000*Math.sin(a)/111195,24+8000*Math.cos(a)/(111195*Math.cos(55*Math.PI/180))]);}
scene=core.createScene();scene.add(route);assert.equal(render(scene)(200,200),255,'closed 50% contours no longer clear their interiors');
scene.addLoops([route]);assert.equal(render(scene)(200,200),0,'explicitly walked saved loops retain their original behavior');
for(const lat of [-80,0,55,80])for(const lon of [-179.99,0,179.99]){
 const [x,y]=core.mercator(lat,lon);assert.ok(Math.abs(core.latitude(y)-lat)<1e-10);
 const p=core.project(view,x,y),back=core.inverse(view,...p);assert.ok(Math.abs(back[1]-y)<1e-9);
}
// Cached pixels stay attached to geography during zoom, pan, rotation and a
// date-line crossing; this prevents visible fog/marker sliding.
for(const lon of [24,179.99]){
 const from={...view,origin:core.mercator(55,lon)};
 const to={origin:core.mercator(55.002,lon===24?24.003:-179.99),a:view.a*.5,b:view.a*.8,c:-view.a*.8,d:view.a*.5,e:196,f:350};
 const t=core.transform(from,to);
 for(const p of [[55,lon],[55.001,lon+.002]]){const m=core.mercator(...p),a=core.project(from,...m),b=core.project(to,...m);assert.ok(Math.hypot(t.a*a[0]+t.c*a[1]+t.e-b[0],t.b*a[0]+t.d*a[1]+t.f-b[1])<1e-6);}
}
scene=core.createScene();scene.add([[55,24],[0,-60],[80,160]]);assert.equal(scene.candidates(view,400,400).length,1,'offscreen history is spatially excluded');
const seam={...view,origin:core.mercator(55,179.99)};scene=core.createScene();scene.add([[55,-179.99]]);assert.equal(scene.candidates(seam,400,400).length,1,'spatial queries cross the date line');

function progressWorker(){
 const output=[],self={postMessage:v=>output.push(v)},context={self};vm.runInNewContext(fs.readFileSync('ETN/progress-worker.js','utf8'),context);
 return{send(data){self.onmessage({data});},calculate(){self.onmessage({data:{type:'calculate',id:1,codes:['LT']}});return output.at(-1).values.LT;}};
}
const country={properties:{code:'LT'},bounds:[23,54,25,56],area:3e10,geometry:{type:'Polygon',coordinates:[[[23,54],[25,54],[25,56],[23,56],[23,54]]]}};
const worker=progressWorker();worker.send({type:'init',maxRadius:5000,clearRadius:500});worker.send({type:'countries',countries:[country]});worker.send({type:'points',points:[[55,24]]});
const one=worker.calculate(),analytic=100*Math.PI*(5000**2+5000*500+500**2)/3/country.area;
assert.ok(Math.abs(one/analytic-1)<.025,'country percentage matches the radial integral');
worker.send({type:'points',points:[[55,24]]});assert.equal(worker.calculate(),one);
worker.send({type:'points',points:[[55,24.3]]});const two=worker.calculate();assert.ok(Math.abs(two/one-2)<.025);
const fresh=progressWorker();fresh.send({type:'init',maxRadius:5000,clearRadius:500});fresh.send({type:'countries',countries:[country]});fresh.send({type:'points',points:[[55,24],[55,24.3]]});assert.ok(Math.abs(fresh.calculate()-two)<1e-10,'incremental results equal a complete rebuild');
console.log('Fog alpha, removed 50% fill, saved loops, spatial culling, cache transforms, date line and incremental country percentages passed.');
