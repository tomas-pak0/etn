/* Intersect a direction ray from the live location with the map frame. */
(function(root){
  'use strict';
  function edgePoint(origin,degrees,width,height,padding=14){
    if(!origin||![origin.x,origin.y,degrees,width,height].every(Number.isFinite)||width<=padding*2||height<=padding*2)return null;
    const angle=degrees*Math.PI/180,dx=Math.sin(angle),dy=-Math.cos(angle);
    let enter=-Infinity,exit=Infinity;
    for(const [p,d,min,max] of [[origin.x,dx,padding,width-padding],[origin.y,dy,padding,height-padding]]){
      if(Math.abs(d)<1e-10){if(p<min||p>max)return null;continue;}
      const first=(min-p)/d,last=(max-p)/d;
      enter=Math.max(enter,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
    }
    if(exit<Math.max(0,enter))return null;
    return{x:origin.x+dx*exit,y:origin.y+dy*exit};
  }
  const api={edgePoint};if(typeof module==='object')module.exports=api;else root.ETNDirections=api;
})(typeof self==='object'?self:globalThis);
