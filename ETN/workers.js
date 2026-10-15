/* WebView intercepts asset fetches on the page, but not on every worker stack.
   Bundle local source into a blob so workers need no network/asset requests. */
(() => {
  'use strict';
  async function open(file,includes=[]){
    const sources=await Promise.all([...includes,file].map(async name=>{const response=await fetch(name);if(!response.ok)throw Error('Worker source unavailable');return response.text();}));
    const script=sources.map(source=>source.replace(/^importScripts\([^\n]*\);\s*$/m,'')).join('\n');
    const url=URL.createObjectURL(new Blob(["self.postMessage({etnWorkerReady:true});\n",script],{type:'text/javascript'}));
    return new Promise((resolve,reject)=>{
      let worker;
      const timer=setTimeout(()=>{worker?.terminate();URL.revokeObjectURL(url);reject(Error('Worker startup timed out'));},10000);
      try{worker=new Worker(url);worker.onmessage=event=>{if(!event.data.etnWorkerReady)return;clearTimeout(timer);URL.revokeObjectURL(url);resolve(worker);};
        worker.onerror=event=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(url);reject(Error(event.message||'Worker startup failed'));};
      }catch(error){clearTimeout(timer);URL.revokeObjectURL(url);reject(error);}
    });
  }
  window.ETNWorkers={open};
})();
