(() => {
  'use strict';
  function create(maxRadius,clearRadius){
    const waiting=new Map();let worker=null,id=0;
    function fail(){if(worker)worker.terminate();worker=null;for(const resolve of waiting.values())resolve({});waiting.clear();}
    try{worker=new Worker('progress-worker.js');worker.onmessage=e=>{const resolve=waiting.get(e.data.id);if(resolve){waiting.delete(e.data.id);resolve(e.data.values);}};worker.onerror=fail;worker.postMessage({type:'init',maxRadius,clearRadius});}catch{fail();}
    const send=(type,value)=>{if(worker)worker.postMessage({type,[type]:value});};
    return{add:points=>send('points',points),loops:rings=>send('loops',rings),countries:value=>send('countries',value),
      calculate(codes=null){if(!worker)return Promise.resolve({});return new Promise(resolve=>{const request=++id;waiting.set(request,resolve);worker.postMessage({type:'calculate',id:request,codes});});}};
  }
  window.ETNProgress={create};
})();
