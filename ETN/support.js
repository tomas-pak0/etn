/* Draft a report in the user's mail app. GPS coordinates are never added. */
(() => {
  'use strict';
  const {t,locale}=window.ETNI18n;
  const {version,supportEmail}=window.ETNConfig;
  const link=document.getElementById('reportBug');
  const subject=t('bugSubject',{version});
  const body=t('bugBody',{version,language:locale});
  link.href=`mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  link.addEventListener('click',event=>{
    if(typeof window.ETNNative?.reportBug!=='function')return;
    event.preventDefault();
    try{window.ETNNative.reportBug(subject,body,t('noMailApp'));}
    catch{location.href=link.href;}
  });
  const info=document.getElementById('mapInfo');
  const toggle=document.getElementById('mapInfoToggle');
  toggle.setAttribute('aria-label',t('mapInfo'));
  toggle.title=t('mapInfo');
  try{info.open=localStorage.getItem('etn-map-info-open')==='true';}catch{}
  info.addEventListener('toggle',()=>{
    try{localStorage.setItem('etn-map-info-open',String(info.open));}catch{}
  });
})();
