'use strict';

// Server-side foundation only. This file is never bundled into the Android WebView.
// Live Google Play Billing, its Google API adapter and a durable store are not enabled.
const {createHash}=require('node:crypto');
const PACKAGE_NAME='lt.tyliaitpk.etn.next';
const PRODUCTS=Object.freeze({
  radius_boost_1h:Object.freeze({feature:'radius',durationMs:60*60*1000,radiusMultiplier:2})
});

function createPurchaseProcessor({google,store,clock=Date.now}){
  if(typeof google?.verifyPurchase!=='function'||typeof google?.consumePurchase!=='function'||
     typeof store?.transaction!=='function')throw Error('Google verifier and transactional storage required');

  return async function process({accountId,productId,purchaseToken}){
    // accountId must come from the authenticated server context, never from client JSON.
    const offer=PRODUCTS[productId];
    if(!offer)throw Error('Unknown product');
    if(typeof accountId!=='string'||!accountId||typeof purchaseToken!=='string'||!purchaseToken)
      throw Error('Missing purchase identity');
    const verified=await google.verifyPurchase({packageName:PACKAGE_NAME,productId,purchaseToken});
    if(verified?.purchaseState==='PENDING')return {state:'pending',entitlement:null};
    if(verified?.purchaseState!=='PURCHASED'||verified.packageName!==PACKAGE_NAME||
       verified.productId!==productId||verified.accountId!==accountId||verified.quantity!==1)
      throw Error('Purchase verification failed');

    const now=clock();
    if(!Number.isSafeInteger(now)||now<0)throw Error('Invalid server time');
    const tokenHash=createHash('sha256').update(purchaseToken).digest('hex');
    const outcome=await store.transaction(async tx=>{
      const existing=await tx.getPurchase(tokenHash);
      if(existing){
        if(existing.accountId!==accountId||existing.productId!==productId)
          throw Error('Purchase already belongs to another identity');
        return {replayed:true,grant:existing};
      }
      // A consumed token without a stored grant must be reconciled, not granted again.
      if(verified.consumed)throw Error('Consumed purchase requires reconciliation');
      const prior=await tx.getEntitlement(accountId,offer.feature);
      const startsAt=Math.max(now,Number.isSafeInteger(prior?.expiresAt)?prior.expiresAt:0);
      const expiresAt=startsAt+offer.durationMs;
      if(!Number.isSafeInteger(expiresAt))throw Error('Invalid expiry');
      const grant={tokenHash,accountId,productId,feature:offer.feature,grantedAt:now,
        startsAt,expiresAt,radiusMultiplier:offer.radiusMultiplier};
      await tx.saveEntitlement(accountId,offer.feature,{expiresAt,radiusMultiplier:offer.radiusMultiplier});
      await tx.savePurchase(tokenHash,grant);
      return {replayed:false,grant};
    });
    // Persist the benefit first. A failed consume can be retried without adding another hour.
    let consumptionPending=false;
    if(!verified.consumed){
      try{await google.consumePurchase({packageName:PACKAGE_NAME,productId,purchaseToken});}
      catch{consumptionPending=true;}
    }
    return {state:'granted',...outcome,consumptionPending};
  };
}

function activeRadiusMeters({baseRadiusMeters=5000,expiresAt,radiusMultiplier=1,now}){
  if(!Number.isFinite(baseRadiusMeters)||baseRadiusMeters<=0||
     !Number.isSafeInteger(now)||now<0)throw Error('Invalid radius or server time');
  return Number.isSafeInteger(expiresAt)&&expiresAt>now&&radiusMultiplier===2
    ?baseRadiusMeters*radiusMultiplier:baseRadiusMeters;
}

module.exports={PACKAGE_NAME,PRODUCTS,createPurchaseProcessor,activeRadiusMeters};
