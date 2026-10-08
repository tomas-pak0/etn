# Būsimų ETN pirkinių pagrindas

ETN 0.6.18 realių mokėjimų nepaleidžia. `ETN/config.js` nustatyta
`purchasesEnabled:false`; Android programėlėje nėra veikiančio pirkimo mygtuko
ar Google Play Billing kliento. `entitlements.cjs` yra atskiras būsimo serverio
logikos pagrindas, į APK neįtraukiamas.

Pirmo produkto projektas: `radius_boost_1h`, vienkartinis sunaudojamas pirkinys,
1 valandai dvigubai didesnis atidengimo spindulys (5 → 10 km). Dydis ir
produkto ID dar gali būti pakeisti prieš aktyvuojant. Kaina čia nenurodyta.
Papildomas pirkinys prideda valandą prie likusio laiko. Vienos valandos laikas
skaičiuojamas pagal serverį ir eina net uždarius programėlę. Tai pasirinktas
prototipo veikimas, kurį būtina aiškiai parodyti prieš apmokėjimą.

Įgyvendinta ir automatizuotai tikrinama:

- Privaloma patvirtinto Google pirkimo būsena `PURCHASED`; `PENDING` neduoda priedo.
- Produkto, programėlės, autentifikuotos tapatybės ir vieno vieneto patikra.
- Unikalus pirkimo žetono SHA-256 ir atominė saugyklos operacija apsaugo nuo
  pakartotinio tos pačios valandos suteikimo, įskaitant vienalaikes užklausas.
- Teisė išsaugoma prieš sunaudojant pirkinį. Sunaudojimą galima kartoti
  nepadvigubinant suteikto laiko.
- Pasibaigus laikui grąžinamas bazinis spindulys.

Prieš realų paleidimą dar reikia:

1. Play Console sukurti ir aktyvuoti vienkartinį produktą, jo pirkimo variantą,
   aprašymus, kainas ir šalis; išjungti kelių vienetų pirkimą šiame prototipe.
2. Android integruoti Google Play Billing: gauti produkto informaciją ir kainą
   iš Google, paleisti apmokėjimo langą, tvarkyti atšaukimus ir atidėtus mokėjimus,
   atnaujinti pirkinius grįžus į programėlę. Vien Console nustatymų neužtenka.
3. Įgyvendinti `google.verifyPurchase` naudojant Play Developer API ir
   `google.consumePurchase` naudojant Google sunaudojimo operaciją. Patvirtinti
   produktą ir tapatybės susiejimą iš Google atsakymo. Serverio Google
   prisijungimo duomenų niekada neįdėti į APK.
4. Pasirinkti autentifikuotos tapatybės sprendimą, patvarią transakcinę duomenų
   bazę ir sunaudojimo pakartojimų eilę. `store.transaction` privalo užtikrinti
   atominį įrašymą, unikalų tokenHash ir rollback. Šiame faile nėra veikiančio
   HTTP serverio, Google adapterio ar produkcinės saugyklos.
5. Susieti serverio teisę su Android ir GPS fono paslauga. Kiekvienam tyrinėjimo
   taškui išsaugoti tuo metu galiojusį spindulį: pasibaigęs priedas neturi ištrinti
   jau atidengtų vietų ar retroaktyviai padidinti visos senos istorijos.
6. Sutvarkyti pinigų grąžinimų ir teisių atšaukimo pranešimus (RTDN), patikrinti
   tikru Google Play bandomuoju pirkiniu ir atnaujinti privatumo informaciją pagal
   pasirinktą serverio ir tapatybės sprendimą.

Šių žingsnių neatlikus flagas turi likti `false`. Testai su Google ir saugyklos
modeliais patvirtina logikos pagrindą, bet nėra tikro mokėjimo patikra.

Oficialios nuorodos:

- https://developer.android.com/google/play/billing/integrate
- https://developer.android.com/google/play/billing/lifecycle/one-time

Patikra: `node tests/entitlements.test.cjs`.
