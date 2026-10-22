/* Timed camera samples: keep turning throughout each GPS interval. */
(() => {
  'use strict';
  const angle=value=>(value%360+360)%360;
  const shortest=(from,to)=>((to-from+540)%360+360)%360-180;
  function heading(initial){
    let value=initial,target=angle(initial),motion=null;
    return {
      get active(){return motion!==null;},
      snap(next){value=target=angle(next);motion=null;return value;},
      set(next,now,duration=1000,displayed=value){
        if(!Number.isFinite(next))return false;
        next=angle(next);
        if(Math.abs(shortest(target,next))<1e-8&&(motion||Math.abs(shortest(displayed,next))<1e-8))return false;
        target=next;value=displayed;
        motion={from:displayed,delta:shortest(displayed,next),at:now,duration:Math.max(1,duration)};
        return true;
      },
      sample(now){
        if(motion){
          const fraction=Math.max(0,Math.min(1,(now-motion.at)/motion.duration));
          value=motion.from+motion.delta*fraction;
          if(fraction===1)motion=null;
        }
        return value;
      }
    };
  }
  window.ETNMotion={heading};
})();

