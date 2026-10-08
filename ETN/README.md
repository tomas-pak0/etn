# ETN – Explore the Neighborhood

ETN 0.6.7 atidengia žemėlapį einant ar važiuojant. Aplink kiekvieną išsaugotą GPS tašką visomis kryptimis taikoma vienoda 5 km riba: iki 500 m žemėlapis visiškai atidengtas, nuo 500 m iki 5 km skaidrumas tolygiai mažėja, už 5 km lieka rūkas. Jei apeinamas pakankamai didelis uždaras kontūras, visas jo vidus atidengiamas. Seniau sukaupti tyrinėjimo taškai išlieka, jiems taip pat taikomas vienodas spindulys. Miško, laukų ir miesto klasifikavimas bei jo tinklo užklausos pašalintos.

Android programėlė, kai tyrinėjimas įjungtas, fone prašo GPS ir tinklo vietos atnaujinimų be minimalaus laiko ar atstumo slenksčio; faktinį dažnį lemia telefonas ir GPS signalas. Vietos tikslumas iki 100 m priimamas; naujas taškas išsaugomas pajudėjus bent 10 m. Fono paslauga rodo ETN pranešimo ikoną. Atidarius programėlę, sukaupti GPS taškai įkeliami viena partija, todėl ilgesni maršrutai neturi blokuoti sąsajos po kiekvieno taško. Tyrinėjimą galima sustabdyti programėlėje arba pranešime.

Šalių ribos ir apytiksliai ištirtas procentas apskaičiuojami pagal vietinius „Natural Earth“ duomenis. Žemėlapio plytelėms reikia interneto, GPS ir jau atsisiųsti ribų duomenys veikia atskirai. Vietų istorija saugoma tik įrenginyje.

Sąsajoje galima pasirinkti ir ukrainiečių kalbą; jei telefono kalba ukrainiečių, ji parenkama automatiškai. Plačiame ekrane pradėjimo ir stabdymo mygtukai centruojami, o telefone užima eilutę nuo vieno krašto iki kito.

Gavus pirmą vietą arba paspaudus centravimo mygtuką žemėlapis parenka mastelį, kuriame telpa visas 5 km spindulys su parašte. Toliau judant GPS žemėlapis seka tuo pačiu masteliu; priartinus ar pastūmus ranka sekimas sustabdomas iki kito centravimo paspaudimo.

Kol sąsaja matoma, ji prašo ekrano budrumo leidimo ir jį atnaujina grįžus į programėlę. Šalies ir ištyrinėtos dalies kortelės rodomos pirmos; spindulys, kryptys, taškai ir vietos tikslumas yra viename išskleidžiamame bloke po jomis.

Kitas etapas: tik patvirtintoms kliūtims atskirose kryptyse trumpinti matomumą. Miško riboms reikalingi tikri geometrijos duomenys, o reljefo užstojimui – aukščių profilis; jų užklausos turi vykti atskirai nuo GPS įrašymo, būti retinamos ir talpinamos podėlyje. Nepasiekiami, nepakankami ar klaidingi duomenys palieka 5 km spindulį. Žemėlapio plytelių spalva vienintelė neturi būti kliūties įrodymas.

## Gyvenviečių ir šalių atradimai (0.6.5)

2026-09-29 „GeoNames“ rinkinio aktyvių gyvenviečių įrašai (be istorinių, apleistų ir sunaikintų vietų bei miestų dalių) suskaidyti į 2° vietines dalis. Apie 5 mln. įrašų pasiekiami be tinklo; šaliai rodomas atrastų įrašų skaičius ir procentas nuo to paties rinkinio šalies įrašų. Tai nėra oficialus ar išsamus visų pasaulio gyvenviečių registras. Tapatybė – GeoNames ID, todėl vienkartiniai sveikinimai nepasilieka pakartotinai atidarius programėlę. GPS vieta laikoma pasiekusia gyvenvietę tik priartėjus prie jos centrinio taško maždaug 350–1000 m atstumu, priklausomai nuo įrašo kategorijos ir žinomo gyventojų skaičiaus; tai ne gyvenvietės ribų modelis. Gyventojų skaičius iš duomenų rinkinio gali būti pasenęs.

Pasiekus naują šalį parodomas vienkartinis pranešimas su sostine, apytiksliu gyventojų skaičiumi, kalbomis ir valiuta, jei tokie duomenys yra. Pasiekus naują gyvenvietę nurodomas jos pavadinimas ir, kai įmanoma, regionas, savivaldybė bei gyventojai. Atradimų raktai ir neperskaityti sveikinimai saugomi vietinėje IndexedDB. Naršymas žemėlapyje atradimų nesukuria. Fono GPS eilė patikrinama prieš patvirtinant jos apdorojimą.

Duomenys: GeoNames, CC BY 4.0, https://www.geonames.org/ . Žemėlapio plytelės iš OpenStreetMap. Šalių ribų duomenys yra apytiksliai „Natural Earth“.

## Savivaldybių ir vietiniai administraciniai centrai (0.6.7)

Atskira šalies kortelė rodo aptiktų centrų skaičių, bendrą rinkinio skaičių ir procentą. Lietuvoje sąrašas apima visų 60 savivaldybių centrus; 55 skirtingi gyvenviečių taškai atitinka 60 savivaldybių, nes kai kurių miestų ir rajonų administracijos yra tame pačiame mieste. Vienas pasiekimas gali padidinti skaitiklį dviem, tačiau gyvenvietė sveikinama tik vieną kartą. Senojoje įrenginio istorijoje jau aptiktos gyvenvietės automatiškai įskaitomos į centrų pažangą.

Kitose šalyse skaičiuojami GeoNames pažymėti PPLA2–PPLA5 vietinių administracinių vienetų centrai. Šių lygių reikšmė skiriasi pagal valstybę ir GeoNames aprėptis nėra pilna; procentas yra nuo šio rinkinio įrašų, ne nuo oficialaus šalies savivaldybių skaičiaus. Centras aptinkamas priartėjus iki 1 km nuo nurodyto taško. Duomenys: GeoNames, CC BY 4.0.

## Atradimų sąrašai ir pranešimai (0.6.8)

Gyvenviečių ir administracinių centrų kortelės išdėstytos greta. Jas palietus eksportuojamas atitinkamas CSV sąrašas: vietovės pavadinimas, šalis, administraciniai duomenys ir GPS taško atradimo laikas. Nauji atradimai saugomi `IndexedDB` įrašų lentelėje; senesnės versijos saugojo tik jau atrasto objekto ID, todėl jų atradimo laiko atkurti neįmanoma. CSV sąraše senesni įrašai pasirodys tik iš naujo aplankius jų vietą ir gali neturėti pradinės datos. Android programėlėje išsaugojimo vieta pasirenkama sistemos lange.

Atradimo langas automatiškai užsidaro po 10 s. Gyventojų skaičius yra apytikslis iš 2026-09-29 GeoNames rinkinio; konkretaus kiekvienos gyvenvietės įverčio metų šaltinis nenurodo. Jei GPS sekimas tęsiamas Android fone, vietinė paslauga tikrina supakuotus šalių, gyvenviečių ir centrų duomenis ir rodo atskirą sistemos pranešimą apie naują įvykį, kai pranešimų leidimas suteiktas. Išsaugojimas naršyklėje įvyksta grįžus į programėlę ir apdorojus GPS eilę.
### 0.6.17

Po viso pasaulio mygtuku pridėtas foto žemėlapio jungiklis, o žemiau – kompasas, perjungiantis šiaurę arba judėjimo kryptį viršuje. Pasirinkimai įsimenami įrenginyje. Žemėlapis naudoja tą patį MapLibre ir OpenFreeMap sprendimą kaip „Kur aš?“; vietovardžiai lieka tiesūs. Foto sluoksnis – Esri World Imagery. Jei įrenginys negali paleisti WebGL, naudojamas Leaflet su lokaliai įtrauktu sukimo papildiniu. Sukantis perskaičiuojamas rūkas ir šalių ribos, išsaugant 500 m–5 km atidengimą. GPS kryptis ir greitis perduodami iš Android paslaugos; sustojus vaizdas išlaiko paskutinę patikimą kryptį. Senų GPS įrašų kryptis prireikus nustatoma pagal judėjimą. Testai: `node tests/map-controls.test.cjs`.

