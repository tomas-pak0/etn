'use strict';
const assert=require('node:assert/strict');
const {createPurchaseProcessor,activeRadiusMeters,PRODUCTS}=require('../billing/entitlements.cjs');
function harness(){
  let now=10000000,consumes=0,verificationCalls=0,consumptionFails=false;
  let verified={purchaseState:'PURCHASED',packageName:'lt.tyliaitpk.etn.next',
    productId:'radius_boost_1h',accountId:'verified-user',quantity:1,consumed:false};
  const purchases=new Map(),entitlements=new Map();
  let queue=Promise.resolve();
  const google={verifyPurchase:async()=>{verificationCalls++;return {...verified};},
    consumePurchase:async()=>{consumes++;if(consumptionFails)throw Error('Offline');}};
  const store={transaction:callback=>{
    const tx={getPurchase:async key=>purchases.get(key),savePurchase:async(key,value)=>purchases.set(key,value),
      getEntitlement:async(id,feature)=>entitlements.get(id+':'+feature),
      saveEntitlement:async(id,feature,value)=>entitlements.set(id+':'+feature,value)};
    const result=queue.then(()=>callback(tx));queue=result.catch(()=>{});return result;
  }};
  return {process:createPurchaseProcessor({google,store,clock:()=>now}),purchases,entitlements,
    request:{accountId:'verified-user',productId:'radius_boost_1h',purchaseToken:'token-one'},
    setVerified:values=>{verified={...verified,...values};},setNow:value=>{now=value;},
    setConsumptionFailure:value=>{consumptionFails=value;},consumes:()=>consumes,calls:()=>verificationCalls};
}
(async()=>{
  assert.equal(PRODUCTS.radius_boost_1h.durationMs,3600000);
  const h=harness(),first=await h.process(h.request);
  assert.equal(first.grant.expiresAt,13600000);
  assert.equal(h.purchases.size,1);assert.equal(h.consumes(),1);
  assert.equal(activeRadiusMeters({...first.grant,now:10000000}),10000);
  assert.equal(activeRadiusMeters({...first.grant,now:13600000}),5000);
  const duplicate=await h.process(h.request);
  assert.equal(duplicate.replayed,true);assert.equal(duplicate.grant.expiresAt,13600000);
  const second=await h.process({...h.request,purchaseToken:'token-two'});
  assert.equal(second.grant.expiresAt,17200000);
  h.setNow(20000000);
  const expired=await h.process({...h.request,purchaseToken:'token-three'});
  assert.equal(expired.grant.startsAt,20000000);assert.equal(expired.grant.expiresAt,23600000);
  const pending=harness();pending.setVerified({purchaseState:'PENDING'});
  assert.equal((await pending.process(pending.request)).state,'pending');
  assert.equal(pending.purchases.size,0);assert.equal(pending.consumes(),0);
  for(const values of [{purchaseState:'CANCELED'},{quantity:2},{productId:'another-product'},
    {packageName:'another-app'},{accountId:'another-user'}]){
    const invalid=harness();invalid.setVerified(values);
    await assert.rejects(invalid.process(invalid.request),/verification failed/);
    assert.equal(invalid.purchases.size,0);assert.equal(invalid.consumes(),0);
  }
  const unknown=harness();await assert.rejects(unknown.process({...unknown.request,productId:'unknown'}),/Unknown/);
  assert.equal(unknown.calls(),0);
  const failed=harness();failed.setConsumptionFailure(true);
  assert.equal((await failed.process(failed.request)).consumptionPending,true);
  failed.setConsumptionFailure(false);
  assert.equal((await failed.process(failed.request)).grant.expiresAt,13600000);
  assert.equal(failed.purchases.size,1);
  const parallel=harness();
  const both=await Promise.all([parallel.process(parallel.request),parallel.process(parallel.request)]);
  assert.equal(parallel.purchases.size,1);assert.equal(both.filter(x=>x.replayed).length,1);
  const consumed=harness();consumed.setVerified({consumed:true});
  await assert.rejects(consumed.process(consumed.request),/reconciliation/);
  console.log('Purchase foundation: verified identity, pending/canceled payments, one-hour expiry, stacking, replay, concurrent requests and consumption retry passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
