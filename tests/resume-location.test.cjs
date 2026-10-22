const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('ETN/app.js','utf8');
const start=source.indexOf('  // History has its own clock:');
const end=source.indexOf("  $('start').onclick",start);
assert.ok(start>0&&end>start);
const now=Date.now(),fixes=Array.from({length:2500},(_,i)=>({id:i+1,lat:54+i*.0002,lon:24,accuracy:5,time:now-(2499-i)*1000}));
let queue=fixes.slice(),latest=fixes.at(-1),point=null,hidden=false;
const moves=[],stored=[],nodes={},events={};
const native={isTracking:()=>true,latestFix:()=>JSON.stringify(latest),pendingFixes:()=>JSON.stringify(queue.slice(0,1000)),ackFixes:id=>{queue=queue.filter(x=>x.id>id);}};
const context={console,Date,Math,Number,JSON,Promise,Event:class{},native,MAX_ACCURACY:100,
 document:{get hidden(){return hidden;},addEventListener:(name,fn)=>events[name]=fn},window:{dispatchEvent(){ }},
 map:{addLocation:p=>{point=p;moves.push({kind:'marker',point:p,snap:true});return{setLatLng(p,o){point=p;moves.push({kind:'marker',point:p,snap:o.animate===false});}};},
  fitBounds(){},panTo:(p,o)=>moves.push({kind:'camera',point:p,snap:o.animate===false}),setHeading(){},distance:(a,b)=>Math.abs(a[0]-b[0])*111000},
 course:{value:null,reset(){},update(){}},headingUp:false,worldActive:false,followPosition:true,marker:null,latestPosition:null,
 storageReady:true,bordersReady:true,watcher:null,importing:false,lastFix:null,trail:[],pendingRaw:[],
 $:id=>nodes[id]??={textContent:'',disabled:false},t:x=>x,locationBounds:p=>p,setCountry(){},renderWorld(){},discoverFix(){},scheduleStorage(){},save(){},
 discovery:{flush:async()=>{}},flushStorage:async()=>{stored.push(...context.pendingRaw.splice(0));},redraw(){},scheduleProgress(){},
 setInterval(){},setTimeout:fn=>{if(fn.name!=='syncNative')queueMicrotask(fn);}};
vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.testApi={syncNative,onPosition,updateLivePosition};',context);
(async()=>{
 // Initial automatic import may already be running; allow it to finish.
 await new Promise(resolve=>setImmediate(resolve));
 for(let i=0;i<4;i++)await context.testApi.syncNative();
 assert.equal(queue.length,0,'all 2500 background samples are acknowledged');
 assert.equal(stored.length,2500,'all background samples remain in exploration history');
 assert.equal(moves.filter(x=>x.kind==='marker').length,1,'batch endpoints never replay on the marker');
 assert.equal(point[0],latest.lat,'first visible marker is the newest native location');
 hidden=true;events.visibilitychange();hidden=false;
 latest={...latest,id:2501,lat:latest.lat+.01,time:now+1000};
 context.window.ETNResume();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(point[0],latest.lat,'resume displays current native fix without waiting for history');
 assert.equal(moves.filter(x=>x.kind==='marker').at(-1).snap,true,'resume cancels travel interpolation');
 const count=moves.length;
 latest={...latest,lat:1,time:now-60000};await context.testApi.syncNative();
 assert.equal(moves.length,count,'stale cached positions cannot pull the marker back');
 context.testApi.updateLivePosition({coords:{latitude:2,longitude:3,accuracy:250},timestamp:now+2000});
 assert.equal(moves.length,count,'poor fixes do not replace the current position');
 console.log('Resume regression passed: 2500 history fixes retained, no batch playback, immediate resume snap, stale/poor fix rejection.');
})().catch(error=>{console.error(error);process.exitCode=1;});
