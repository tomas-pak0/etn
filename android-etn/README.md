# ETN Android

ETN 0.6.4 programėlė (`lt.tyliaitpk.etn.next`) turi fono vietos paslaugą ir lokaliai supakuotą žemėlapio sąsają. Pavadinimas telefone – ETN. Leidimas pasirašomas tuo pačiu sertifikatu kaip 0.4.2–0.5.0, todėl įsidiegia ant šių versijų nepašalinant jų įrenginyje saugomos istorijos. Pirminė `lt.tyliaitpk.etn` versija yra atskira programėlė su atskira istorija.

Vietos paslauga prašo GPS ir tinklo atnaujinimų su `minTimeMs=0` ir `minDistanceM=0`; realus dažnis priklauso nuo Android ir įrenginio. Sekimas įjungiamas tik ekrane ir tęsiamas kaip vietos tipo foreground paslauga, rodanti nuolatinį pranešimą. Android 13+ reikia pranešimų leidimo, kad matytųsi juostos piktograma. Svarbiausiam funkcionalumui prašoma tikslios vietos. Neleista vieta, priverstinis programėlės stabdymas arba ryšio su palydovais praradimas gali nutraukti fiksavimą.

Žemėlapio rūkas yra vienodas: 500 m visiškai aišku, toliau tolygiai tamsėja iki 5 km. Programėlė neklasifikuoja vietovės ir nekviečia „Overpass“. Senieji taškai išsaugomi, o jų ankstesnės vietovės klasės nebetaikomos. Daug GPS fone sukauptų taškų į WebView istoriją importuojama viena partija. Šalių ribos supakuotos kartu; „OpenStreetMap“ plytelėms reikalingas internetas.

Surinkimas: kopijuoti `demo/etn/index.html`, `style.css`, `i18n.js`, `app.js`, aplankus `vendor` ir `data` į `android-etn/app/src/main/assets`; vykdyti `gradle :app:assembleDebug` su Gradle 8.11.1, JDK 17 ir Android SDK 35. Viešas APK pasirašomas atskiru pastoviu raktu; laikinas „GitHub Actions“ debug APK nėra viešas naujinys. Sertifikato SHA-256: `a68cd0b8f2b8cfbe1af4ae7f5aa4cd57055e31dd3d2220ad1aa4b0d6ef371a94`. Raktas nesaugomas viešoje repozitorijoje.
