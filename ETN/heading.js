/* Movement heading: prefer reliable GPS course and hold direction at rest. */
(() => {
  'use strict';
  const angle=value=>(value%360+360)%360;
  function bearing(a,b){
    const r=Math.PI/180,lat1=a[0]*r,lat2=b[0]*r,dlon=(b[1]-a[1])*r;
    return angle(Math.atan2(Math.sin(dlon)*Math.cos(lat2),
      Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dlon))/r);
  }
  function create(distance){
    let anchor=null,heading=null;
    return{
      get value(){return heading;},
      reset(){anchor=null;},
      update(coords,time){
        const point=[coords.latitude,coords.longitude],accuracy=coords.accuracy;
        if(!point.every(Number.isFinite)||!Number.isFinite(accuracy)||accuracy>100)return heading;
        if(anchor&&time<=anchor.time)return heading;
        const seconds=anchor?(time-anchor.time)/1000:0;
        const moved=anchor?distance(anchor.point,point):0;
        const speed=Number.isFinite(coords.speed)&&coords.speed>=0?coords.speed:null;
        const nativeCourse=Number.isFinite(coords.heading)&&coords.heading>=0&&coords.heading<=360&&
          (!Number.isFinite(coords.headingAccuracy)||coords.headingAccuracy<=35);
        if(nativeCourse&&speed!==null&&speed>=.7){
          heading=angle(coords.heading);anchor={point,time,accuracy};return heading;
        }
        if(speed!==null&&speed<.7){anchor={point,time,accuracy};return heading;}
        if(anchor&&seconds>0&&seconds<=30&&moved>=Math.max(12,(accuracy+anchor.accuracy)/2)&&moved/seconds>=.7){
          heading=bearing(anchor.point,point);anchor={point,time,accuracy};
        }else if(!anchor||seconds>30)anchor={point,time,accuracy};
        return heading;
      }
    };
  }
  window.ETNHeading={create,bearing};
})();
