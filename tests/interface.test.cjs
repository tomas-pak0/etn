const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const elements=new Map(),node=id=>{if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},setAttribute(){},addEventListener(){}});return elements.get(id);};
for(const language of ['lt','en','lv','pl','de','es','fr','it','ru','uk']){
 const context={window:{},localStorage:{getItem:()=>language},navigator:{language},document:{documentElement:{},getElementById:node,querySelectorAll:()=>[]}};
 vm.runInNewContext(fs.readFileSync('ETN/i18n.js','utf8'),context);vm.runInNewContext(fs.readFileSync('ETN/interface-i18n.js','utf8'),context);
 const api=context.window.ETNI18n;
 for(const key of ['navMap','navExplored','navExplorers','navInfo','blankMap','sharingNote','connectAccount','deleteAccount','deleteConfirm','rankingOffline'])assert.notEqual(api.t(key),key,language+' '+key);
 assert.ok(!api.t('signInMethods').includes('ChatGPT')&&api.t('signInMethods').includes('Google'),'external sign-in methods in '+language);
}
const source=fs.readFileSync('ETN/index.html','utf8'),ids=[...source.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'IDs remain unique after relocating existing controls');
for(const id of ['pageMap','pageExplored','pageExplorers','pageInfo','cardinalOverlay','start','stop','reportBug','language','countryProgress','settlementProgress'])assert(ids.includes(id));
console.log('Four application panels, preserved controls, unique IDs and ten-language account/navigation strings passed.');
