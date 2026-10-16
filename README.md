# ETN – Explore the Neighborhood

## ETN 0.7.3

Pasaulio krypčių padalos remiasi esamos vietos žymekliu, įskaitant GPS animaciją, žemėlapio slinkimą ir pasukimą.

Fiksuota viršutinė juosta ir keturi apatinio meniu skirtukai: Žemėlapis, Ištirta, Tyrinėtojai ir Informacija. Žemėlapis užima visą tarp juostų likusį plotą, jo kraštuose rodomos pagal kalbą ir pasukimą pritaikytos pasaulio kryptys. Baltas režimas išjungia kartografinį foną; GPS, vietiniai šalių kontūrai ir rūkas veikia toliau. 50 % skaidrumo kontūrų automatinis atidengimas pašalintas. Rūkas skaičiuojamas atskirame procese kaip artimiausio atstumo laukas, su erdvine istorijos atranka ir podėliu. Slenkant, sukant ar keičiant mastelį naudojama vieno vaizdo transformacija; animacijos kadruose istorija neperžiūrima ir pikseliai neskaitomi. GPS vietos žymeklis ir kamera interpoliuojami, šalių procentai skaičiuojami atskirame procese, o statistika skaito tik naujus įrašus. Ankstesnė istorija ir foninis GPS išsaugomi.

Pasirenkama paskyra: „ChatGPT“ prisijungimas naršyklėje, ETN slapyvardis ir kilmės šalis. Telefonas patvirtinamas 10 minučių galiojančia užklausa ir sutampančiu šešiaženkliu kodu. Serveriui siunčiami tik šalių ištirti procentai. GPS taškai ir maršrutai lieka telefone. Reitingas parenkamas pagal GPS šalį, rodo pirmus 10 ir tikrą savo vietą papildomoje eilutėje. Vėliava nepriklauso nuo GPS šalies. Paskyra ir jos vieši rezultatai ištrinami iš programėlės arba paskyros puslapio.

Paslauga: https://etn-explorers.t0m45-p4k0.chatgpt.site
Android: versionCode 40, versionName 0.7.3, tas pats applicationId ir pasirašymo raktas.

Patikros: `node tests/interface.test.cjs`, `node tests/fog.test.cjs`, ankstesni map-controls/support/entitlements testai; serverio 12 vartotojų integracinė patikra (autentifikacija, top 10 ir tikra 12 vieta, vėliava, didėjantis sinchronizavimas, ištrynimas).

Visas GeoNames rinkinys atkuriamas Android surinkimo darbo eigoje iš ankstesnio pilno leidimo. Pasirašymo raktai į viešą saugyklą nekeliami.
