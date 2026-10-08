# Gyvenviečių šaltinis ir duomenų dydis

Patikrinta iš ETN 0.6.17 AAB vietinių duomenų:

| Rodiklis | Reikšmė |
| --- | ---: |
| Lietuvos GeoNames gyvenviečių įrašai | 20 555 |
| Pasaulio GeoNames gyvenviečių įrašai | 4 999 498 |
| Gyvenviečių dalių skaičius | 4 552 |
| Jau gzip suspaustos gyvenviečių dalys | 78,7 MiB |
| Visi programėlės assets | 82,7 MiB |

Tai duomenų rinkinio įrašai, ne oficialus Lietuvos gyvenviečių skaičius.
Generatorius atmeta istorines, apleistas, sunaikintas vietas ir miestų dalis.
Vis dėlto likę GeoNames įrašai nėra susieti su OpenStreetMap vietovardžiais.

JavaScript į atmintį krauna tik netoliese esančias 2° dalis ir naudoja vietinį
smulkesnį paieškos tinklelį. Talpykla turi iki 12 dalių. Visa planeta vienu metu
į atmintį nekraunama. Visi duomenys supakuoti Android assets, todėl jų dydis
didina atsisiuntimą ir įdiegtą programėlę, bet GPS jų iš interneto nesiunčia.

Galima naudoti tik žemėlapio šaltinio gyvenvietes. Stabiliai versijai reikia
fiksuoto OpenStreetMap/OpenMapTiles duomenų išrašo ir atrankos, pavyzdžiui,
`place=city`, `town`, `village`, `hamlet`. Tik „šiuo metu ekrane atspausdintas
pavadinimas“ netinka bendram šalies skaičiui: rodymą keičia mastelis, stilius,
užrašų persidengimas ir interneto ryšys. Fone, kai žemėlapis nerenderinamas,
vien tik ekrano užrašų užklausa gyvenviečių neaptiktų.

Prieš keitimą reikia paruošti pastovų kiekvienos šalies bendrą skaičių,
vietinę arba atsisiunčiamą regionų paiešką ir ankstesnių GeoNames ID susiejimą
su OSM ID. Nevienareikšmiai senų atradimų atitikmenys turi būti palikti istorijoje,
o procentas turi aiškiai nurodyti, kurio rinkinio atžvilgiu skaičiuojamas.
Duomenų keitimas neturi tyliai šalinti atradimų ar keisti senųjų jų datų.

Alternatyva, jei tikslas daugiausia sumažinti APK: palikti tą patį GeoNames
rinkinio indeksą ir šalies vardiklį, o gyvenviečių dalis atsisiųsti tik pagal
regioną. Tuomet neatsisiųstuose regionuose gyvenviečių paieškai reikėtų ryšio;
GPS maršruto įrašymas galėtų tęstis atskirai. Reikėtų talpyklos, prieigos be
interneto nustatymų ir tikrinamų failų versijų bei kontrolinių sumų.

ETN 0.6.18 duomenų rinkinio ir atradimų identifikatorių nekeičia.

Schema: https://openmaptiles.org/docs/schema/#place
Žemėlapyje matomi objektai:
https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#queryrenderedfeatures
