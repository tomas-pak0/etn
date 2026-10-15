const assert=require('node:assert/strict'),{edgePoint}=require('../ETN/directions.js');
const origin={x:80,y:510},width=390,height=700;
assert.deepEqual(edgePoint(origin,0,width,height),{x:80,y:14});
const east=edgePoint(origin,90,width,height);assert.ok(Math.abs(east.x-376)<1e-8&&Math.abs(east.y-510)<1e-8);
assert.ok(Math.abs(edgePoint(origin,180,width,height).y-686)<1e-8);
for(const bearing of [0,30,90,180,359])for(let i=0;i<24;i++){
 const degrees=i*15-bearing,p=edgePoint(origin,degrees,width,height);assert.ok(p);
 const a=degrees*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a),px=p.x-origin.x,py=p.y-origin.y;
 assert.ok(Math.abs(px*dy-py*dx)<1e-7,'direction ray passes through the live location');
 assert.ok(px*dx+py*dy>=0,'label is on the correctly named side of the location');
 assert.ok(Math.min(Math.abs(p.x-14),Math.abs(p.x-376),Math.abs(p.y-14),Math.abs(p.y-686))<1e-7,'label stays on the frame');
}
assert.equal(edgePoint({x:-200,y:350},270,width,height),null,'outward rays are hidden when location is offscreen');
assert.ok(Math.abs(edgePoint({x:-200,y:350},90,width,height).x-376)<1e-7,'inward rays remain attached to the offscreen location');
assert.equal(edgePoint(origin,0,0,0),null);
console.log('Directions follow the off-center live location, rotation, frame edges and offscreen rays.');
