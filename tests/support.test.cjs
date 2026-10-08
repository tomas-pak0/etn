'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(`${__dirname}/../ETN/${name}`,'utf8');
const index=read('index.html');
assert(index.indexOf('class="data-credit"')<index.indexOf('id="reportBug"'));
assert(index.includes('<details id="mapInfo"'));
assert(!index.includes('<details id="mapInfo" class="map-info" open'));
function context(language,native,storageThrows=false){
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{textContent:'',title:'',href:'',open:false,
      attrs:{},listeners:{},setAttribute(key,value){this.attrs[key]=value;},
      addEventListener(key,value){this.listeners[key]=value;}});
    return elements.get(id);
  }
  const saved=new Map();
  const window={ETNNative:native};
  const c=vm.createContext({window,navigator:{language},location:{href:'',reload(){}},
    document:{documentElement:{lang:''},getElementById:element,querySelectorAll:()=>[]},
    localStorage:{getItem:key=>{if(storageThrows)throw Error('Unavailable');return saved.get(key)||null;},
      setItem:(key,value)=>{if(storageThrows)throw Error('Unavailable');saved.set(key,value);}},
    Date,Intl,encodeURIComponent,Object,String});
  vm.runInContext(read('config.js'),c);vm.runInContext(read('i18n.js'),c);
  vm.runInContext(read('support.js'),c);
  return {window,elements,saved,c};
}
const keys=['dataCredit','reportBug','mapInfo','mapSources','mapFogNote','mapControlsNote','bugSubject','bugBody','noMailApp'];
for(const language of ['lt','lv','pl','en','de','es','fr','it','ru','uk']){
  const c=context(language),dict=c.window.ETNI18n.dictionaries[language];
  for(const key of keys)assert.equal(typeof dict[key],'string',`${language}: ${key}`);
  const href=c.elements.get('reportBug').href;
  const parsed=new URL(href);
  assert.equal(parsed.pathname,'info@tyliaitpk.com');
  assert(parsed.searchParams.get('subject').includes('0.6.18'));
  const body=parsed.searchParams.get('body');
  assert(body.includes('\n1.\n2.\n'));assert(body.includes(language));
  assert(!body.includes('{version}'));assert(!body.includes('{language}'));
  assert.equal(c.elements.get('mapInfo').open,false);
  c.elements.get('mapInfo').open=true;c.elements.get('mapInfo').listeners.toggle();
  assert.equal(c.saved.get('etn-map-info-open'),'true');
}
let passed=null,prevented=false;
const native=context('lt',{reportBug:(...args)=>{passed=args;}});
native.elements.get('reportBug').listeners.click({preventDefault(){prevented=true;}});
assert(prevented);assert.equal(passed.length,3);assert(passed[1].includes('Klaidos aprašymas'));
const failure=context('en',{reportBug:()=>{throw Error('Unavailable');}},true);
failure.elements.get('reportBug').listeners.click({preventDefault(){}});
assert(failure.c.location.href.startsWith('mailto:info@tyliaitpk.com?subject='));
console.log('Bug report: ten translations, encoded multiline email, native draft, fallback, collapsed map information and storage failure passed.');
