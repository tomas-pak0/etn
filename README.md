# ETN – Explore the Neighborhood

## ETN 0.7.0

Fiksuota viršutinė juosta ir keturi apatinio meniu skirtukai: Žemėlapis, Ištirta, Tyrinėtojai ir Informacija. Žemėlapis užima visą tarp juostų likusį plotą, jo kraštuose rodomos pagal kalbą ir pasukimą pritaikytos pasaulio kryptys. Baltas režimas išjungia kartografinį foną; GPS, vietiniai šalių kontūrai ir rūkas veikia toliau. Uždari 50 % matomumo kontūrai nustatomi geografiniame 250 m tinklelyje atskirame Worker ir jų vidus atidengiamas. Ankstesnė istorija ir foninis GPS išsaugomi.

Pasirenkama paskyra: „ChatGPT“ prisijungimas naršyklėje, ETN slapyvardis ir kilmės šalis. Telefonas patvirtinamas 10 minučių galiojančia užklausa ir sutampančiu šešiaženkliu kodu. Serveriui siunčiami tik šalių ištirti procentai. GPS taškai ir maršrutai lieka telefone. Reitingas parenkamas pagal GPS šalį, rodo pirmus 10 ir tikrą savo vietą papildomoje eilutėje. Vėliava nepriklauso nuo GPS šalies. Paskyra ir jos vieši rezultatai ištrinami iš programėlės arba paskyros puslapio.

Paslauga: https://etn-explorers.t0m45-p4k0.chatgpt.site
Android: versionCode 37, versionName 0.7.0, tas pats applicationId ir pasirašymo raktas.

Patikros: `node tests/interface.test.cjs`, `node tests/fog.test.cjs`, ankstesni map-controls/support/entitlements testai; serverio 12 vartotojų integracinė patikra (autentifikacija, top 10 ir tikra 12 vieta, vėliava, didėjantis sinchronizavimas, ištrynimas).

Visas GeoNames rinkinys atkuriamas Android surinkimo darbo eigoje iš ankstesnio pilno leidimo. Pasirašymo raktai į viešą saugyklą nekeliami.
