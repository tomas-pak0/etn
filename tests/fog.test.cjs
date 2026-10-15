const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const scope={};vm.runInNewContext(fs.readFileSync('ETN/fog-geometry.js','utf8'),scope);
const build=points=>{const g=scope.ETNFogGeometry.create();g.add(points);return g.holes();};
const route=[];
for(let angle=0;angle<360;angle+=2){const a=angle*Math.PI/180;route.push([55+8000*Math.sin(a)/111195,24+8000*Math.cos(a)/(111195*Math.cos(55*Math.PI/180))]);}
assert.ok(build(route).length,'an enclosed half-visible contour reveals its interior');
assert.equal(build(route.slice(0,110)).length,0,'an open route cannot reveal its interior');
assert.equal(build([[55,24]]).length,0,'a single clearing is not an enclosed hole');
assert.equal(build(Array.from({length:100},(_,i)=>[55,24+i*.001])).length,0,'a straight route must not reveal unrelated land');
const first=build(route),g=scope.ETNFogGeometry.create();g.add(route);g.add(route);assert.equal(g.holes().length,first.length,'duplicate fixes do not alter topology');
const seam=route.map(([lat,lon])=>[lat,((lon-24+179.98+540)%360)-180]);
assert.ok(build(seam).length,'the contour also closes across the international date line');
console.log('Geographic 50% contour: closed/open routes, isolated points, duplicate fixes and date line passed.');
