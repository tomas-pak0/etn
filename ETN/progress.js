(() => {
  'use strict';
  function create(maxRadius,clearRadius){
    const waiting=new Map(),queued=[];let worker=null,id=0,booting=true;
    function fail(){if(worker)worker.terminate();worker=null;booting=false;queued.length=0;for(const resolve of waiting.values())resolve({});waiting.clear();}
    window.ETNWorkers.open('progress-worker.js').then(created=>{worker=created;worker.onmessage=e=>{const resolve=waiting.get(e.data.id);if(resolve){waiting.delete(e.data.id);resolve(e.data.values);}};worker.onerror=fail;worker.postMessage({type:'init',maxRadius,clearRadius});for(const message of queued)worker.postMessage(message);queued.length=0;booting=false;}).catch(fail);
    const post=message=>{if(worker)worker.postMessage(message);else if(booting)queued.push(message);};
    const send=(type,value)=>post({type,[type]:value});
    return{add:points=>send('points',points),loops:rings=>send('loops',rings),countries:value=>send('countries',value),
      calculate(codes=null){if(!worker&&!booting)return Promise.resolve({});return new Promise(resolve=>{const request=++id;waiting.set(request,resolve);post({type:'calculate',id:request,codes});});}};
  }
  window.ETNProgress={create};
})();
