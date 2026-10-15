/* Dense-history integration check inside the actual Android WebView. */
const assert=require('node:assert/strict'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8'});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let socket,nextId=0;const pending=new Map(),exceptions=[];
async function connect(){
 const sockets=adb('shell','cat','/proc/net/unix'),name=sockets.match(/@?(webview_devtools_remote_\d+)/)?.[1];
 assert.ok(name,'Debug WebView socket missing');adb('forward','tcp:9222','localabstract:'+name);
 const pages=await (await fetch('http://127.0.0.1:9222/json/list')).json(),page=pages.find(p=>p.url.includes('appassets.androidplatform.net'));
 assert.ok(page,'ETN WebView page missing');socket=new WebSocket(page.webSocketDebuggerUrl);
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.text);const request=pending.get(data.id);if(request){pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);}});
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 await call('Runtime.enable');
}
function call(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},60000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const result=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
async function waitFor(expression){for(let i=0;i<100;i++){try{if(await evaluate(expression))return;}catch{}await delay(200);}throw Error('Timed out waiting for '+expression);}
(async()=>{
 await connect();await waitFor('!!window.ETNState');
 await evaluate(`(async()=>{
   localStorage.setItem('etn-blank-map-v1','true');
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('etn-history',1);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   const tx=db.transaction(['coverage','fixes'],'readwrite');
   for(let i=0;i<10000;i++){const lat=55+(Math.floor(i/100)-50)*.00068,lon=24+(i%100-50)*.00118;tx.objectStore('coverage').put({key:'performance-'+i,lat,lon});}
   for(let i=0;i<500;i++)tx.objectStore('fixes').add({lat:55,lon:24+i*.0002,time:Date.now()-500000+i*1000,accuracy:5});
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=reject;});db.close();return true;
 })()`);
 await call('Page.reload');await delay(500);await waitFor('!!window.ETNState && window.ETNState.fogPerformance().paints>0');
 await evaluate(`ETNInterface.show('pageMap');ETNState.map.renderer.jumpTo({center:[24,55],zoom:12});true`);
 await waitFor('ETNState.fogPerformance().worker && ETNState.fogPerformance().visibleSamples>=5000');
 const result=await evaluate(`(async()=>{
   const map=ETNState.map,before=ETNState.fogPerformance(),times=[],costs=[],longTasks=[];
   let readbacks=0;const original=CanvasRenderingContext2D.prototype.getImageData;
   CanvasRenderingContext2D.prototype.getImageData=function(...args){readbacks++;return original.apply(this,args);};
   const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(x=>x.duration)));observer.observe({entryTypes:['longtask']});
   const marker=map.addLocation([55,24]);let intermediate=0;
   const percentages=ETNState.allProgress();
   await new Promise(resolve=>{let i=0;function frame(now){if(i===0)marker.setLatLng([55.002,24.004]);const start=performance.now();times.push(now);map.renderer.jumpTo({center:[24+.002*Math.sin(i/30),55+.002*Math.cos(i/30)],bearing:i*2});const lat=marker.getLatLng().lat;if(lat>55&&lat<55.002)intermediate++;costs.push(performance.now()-start);if(++i<180)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
   await percentages;observer.disconnect();CanvasRenderingContext2D.prototype.getImageData=original;
   const after=ETNState.fogPerformance(),sorted=costs.slice().sort((a,b)=>a-b);
   return{samples:10000,frames:times.length,fps:(times.length-1)*1000/(times.at(-1)-times[0]),mainPixelReadbacks:readbacks,cameraP95Ms:sorted[Math.floor(sorted.length*.95)],longestTaskMs:Math.max(0,...longTasks),fogBefore:before,fogAfter:after,markerIntermediateFrames:intermediate,markerEnd:marker.getLatLng().lat};
 })()`);
 assert.equal(result.mainPixelReadbacks,0,'Camera movement must never read fog pixels on the UI thread');
 assert.ok(result.fogAfter.transforms-result.fogBefore.transforms>80,'Geographic snapshot must follow camera frames');
 assert.ok(result.fogAfter.paints-result.fogBefore.paints<30,'Movement must reuse snapshots');
 assert.ok(result.markerIntermediateFrames>2,'Location must move through intermediate positions');
 assert.ok(Math.abs(result.markerEnd-55.002)<1e-9,'Location reaches the GPS fix');
 assert.deepEqual(exceptions,[],'Unhandled WebView errors');
 fs.writeFileSync('evidence/dense-history-performance.json',JSON.stringify(result,null,2)+'\n');
 execFileSync('adb',['exec-out','screencap','-p'],{stdio:['ignore',fs.openSync('evidence/08-dense-history.png','w'),'inherit']});
 console.log('Android dense-history performance passed: '+JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();for(const p of pending.values())clearTimeout(p.timer);});
