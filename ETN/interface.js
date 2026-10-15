(() => {
  'use strict';
  const $=id=>document.getElementById(id),{t,locale}=window.ETNI18n,state=window.ETNState;
  const tabs=[...document.querySelectorAll('.bottom-nav [role=tab]')];
  let page='pageMap',statsBusy=false;
  function show(id,focus=false){
    if(!tabs.some(tab=>tab.dataset.page===id))return;
    page=id;
    for(const panel of document.querySelectorAll('.app-page'))panel.hidden=panel.id!==id;
    for(const tab of tabs){const active=tab.dataset.page===id;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    if(id==='pageMap'){requestAnimationFrame(()=>{state.resize();cardinals();});}
    if(id==='pageExplored')statistics();
    if(id==='pageExplorers')window.dispatchEvent(new Event('etn-ranking-open'));
    if(focus)$(id).querySelector('.page-title')?.focus();
  }
  tabs.forEach((tab,index)=>{
    tab.onclick=()=>show(tab.dataset.page);
    tab.onkeydown=event=>{let i=index;if(event.key==='ArrowRight')i=(index+1)%tabs.length;else if(event.key==='ArrowLeft')i=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();tabs[i].focus();show(tabs[i].dataset.page);};
  });
  async function statistics(){
    if(statsBusy)return;statsBusy=true;
    try{
      const [rows,stats]=await Promise.all([state.allProgress(),state.statistics()]);
      $('visitedCountries').textContent=String(rows.length);
      $('exploredArea').textContent=rows.reduce((n,row)=>n+row.areaKm2,0).toLocaleString(locale,{maximumFractionDigits:1})+' km²';
      if(stats){
        $('travelledDistance').textContent=(stats.distance/1000).toLocaleString(locale,{maximumFractionDigits:1})+' km';
        $('explorationDays').textContent=String(stats.days);
        for(const [id,value] of [['firstExploration',stats.first],['lastExploration',stats.last]])$(id).textContent=value?new Date(value).toLocaleDateString(locale):'–';
      }
      const list=$('countryHistory');list.replaceChildren();
      for(const row of rows){
        const button=document.createElement('button');button.type='button';button.className='country-history-row';button.setAttribute('role','listitem');
        const name=document.createElement('span'),percent=document.createElement('strong');
        name.textContent=flag(row.code)+' '+row.name;percent.textContent=formatPercent(row.percent);button.append(name,percent);
        button.onclick=()=>{show('pageMap');requestAnimationFrame(()=>state.showCountry(row.code));};list.append(button);
      }
      if(!rows.length){const p=document.createElement('p');p.className='hint';p.textContent=t('noHistory');list.append(p);}
    }finally{statsBusy=false;}
  }
  const flag=code=>/^[A-Z]{2}$/.test(code||'')?String.fromCodePoint(...[...code].map(c=>127397+c.charCodeAt(0))):'🌐';
  const formatPercent=value=>Number(value).toLocaleString(locale,{minimumFractionDigits:5,maximumFractionDigits:5})+' %';
  let blank=false;
  try{blank=localStorage.getItem('etn-blank-map-v1')==='true';}catch{}
  function blankMap(){
    state.map.setBlank(blank);$('blankButton').setAttribute('aria-pressed',String(blank));$('blankButton').textContent=t(blank?'restoreMap':'blankMap');
    document.querySelector('.map-shell').classList.toggle('blank-active',blank);
  }
  $('blankButton').onclick=()=>{blank=!blank;try{localStorage.setItem('etn-blank-map-v1',String(blank));}catch{}blankMap();};blankMap();
  const directions={lt:['Š','ŠR','R','PR','P','PV','V','ŠV'],lv:['Z','ZA','A','DA','D','DR','R','ZR'],pl:['N','NE','E','SE','S','SW','W','NW'],de:['N','NO','O','SO','S','SW','W','NW'],fr:['N','NE','E','SE','S','SO','O','NO'],es:['N','NE','E','SE','S','SO','O','NO'],it:['N','NE','E','SE','S','SO','O','NO'],ru:['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'],uk:['Пн','ПнСх','Сх','ПдСх','Пд','ПдЗх','Зх','ПнЗх']};
  const labels=directions[locale]||['N','NE','E','SE','S','SW','W','NW'],overlay=$('cardinalOverlay');
  const marks=Array.from({length:24},(_,i)=>{const node=document.createElement('span');node.className=i%3===0?'cardinal-label':'cardinal-tick';if(i%3===0)node.textContent=labels[i/3];overlay.append(node);return node;});
  function cardinals(){
    const width=overlay.clientWidth,height=overlay.clientHeight;if(width<1||height<1)return;
    const bearing=state.world()?0:state.map.getBearing(),hw=Math.max(1,width/2-14),hh=Math.max(1,height/2-14);
    marks.forEach((node,i)=>{const a=(i*15-bearing)*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a),d=Math.min(hw/Math.max(1e-9,Math.abs(dx)),hh/Math.max(1e-9,Math.abs(dy)));node.style.left=(width/2+dx*d)+'px';node.style.top=(height/2+dy*d)+'px';node.style.transform='translate(-50%,-50%)'+(i%3?' rotate('+(i*15-bearing)+'deg)':'');});
  }
  state.map.on('rotate resize',cardinals);new ResizeObserver(cardinals).observe(overlay);$('worldButton').addEventListener('click',cardinals);
  window.addEventListener('etn-progress',()=>{if(page==='pageExplored')statistics();});
  window.ETNInterface={show,flag,formatPercent};
  show('pageMap');
})();
