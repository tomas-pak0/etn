"""Build a compact index of local administrative seats from the bundled GeoNames tiles.

Lithuania's 60 municipalities use a curated municipality-to-settlement mapping:
GeoNames marks only a subset of their seats as PPLA2. Elsewhere PPLA2/PPLA3/
PPLA4/PPLA5 are included as the available local-administration approximation.
The resulting denominator is a count of mapped administrative units, not towns.
"""
import collections
import gzip
import json
import pathlib
import unicodedata

DATA = pathlib.Path(__file__).resolve().parent.parent / "ETN" / "data"
LT_SEATS = dict(line.split(" ", 1) for line in """
LT.56.11 Alytus
LT.56.15 Druskininkai
LT.56.33 Alytus
LT.56.38 Varėna
LT.56.59 Lazdijai
LT.57.12 Birštonas
LT.57.19 Kaunas
LT.57.46 Jonava
LT.57.49 Kaišiadorys
LT.57.52 Kaunas
LT.57.53 Kėdainiai
LT.57.69 Prienai
LT.57.72 Raseiniai
LT.58.21 Klaipėda
LT.58.23 Nida
LT.58.25 Palanga
LT.58.55 Gargždai
LT.58.56 Kretinga
LT.58.75 Skuodas
LT.58.88 Šilutė
LT.59.18 Marijampolė
LT.59.39 Vilkaviškis
LT.59.48 Kalvarija
LT.59.58 Kazlų Rūda
LT.59.84 Šakiai
LT.60.27 Panevėžys
LT.60.36 Biržai
LT.60.57 Kupiškis
LT.60.66 Panevėžys
LT.60.67 Pasvalys
LT.60.73 Rokiškis
LT.61.29 Šiauliai
LT.61.32 Naujoji Akmenė
LT.61.47 Joniškis
LT.61.54 Kelmė
LT.61.65 Pakruojis
LT.61.71 Radviliškis
LT.61.91 Šiauliai
LT.62.63 Pagėgiai
LT.62.77 Tauragė
LT.62.87 Šilalė
LT.62.94 Jurbarkas
LT.63.61 Mažeikiai
LT.63.68 Plungė
LT.63.74 Rietavas
LT.63.78 Telšiai
LT.64.30 Visaginas
LT.64.34 Anykščiai
LT.64.43 Zarasai
LT.64.45 Ignalina
LT.64.62 Molėtai
LT.64.82 Utena
LT.65.13 Vilnius
LT.65.41 Vilnius
LT.65.42 Elektrėnai
LT.65.79 Trakai
LT.65.81 Ukmergė
LT.65.85 Šalčininkai
LT.65.86 Švenčionys
LT.65.89 Širvintos
""".strip().splitlines())


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold())
                   if not unicodedata.combining(c)).replace("ł", "l")


def tile_id(lat, lon):
    return f"{min(89, max(0, int((lat + 90) // 2))):02d}-{min(179, max(0, int((lon + 180) // 2))):03d}"


def main():
    admin2 = json.load(gzip.open(DATA / "admin2.bin", "rt", encoding="utf-8"))
    assert set(LT_SEATS) == {key for key in admin2 if key.startswith("LT.")}
    index = json.load(gzip.open(DATA / "places-index.bin", "rt", encoding="utf-8"))
    local = collections.defaultdict(list)
    seats = []
    for tile in index["tiles"]:
        for row in json.load(gzip.open(DATA / "places" / f"{tile}.bin", "rt", encoding="utf-8")):
            ident, name, lat, lon, code, feature, a1, a2, population = row
            if code == "LT":
                local[normalize(name)].append(row)
            elif feature in {"PPLA2", "PPLA3", "PPLA4", "PPLA5"}:
                # GeoNames ID is the stable identity when an administrative code is absent.
                seats.append([f"{code}:{ident}", ident, name, lat, lon, code, ""])

    for unit, name in LT_SEATS.items():
        options = local.get(normalize(name), [])
        if not options:
            raise ValueError(f"No GeoNames settlement for {unit}: {name}")
        # Prefer the actual major town over small homonyms.
        row = max(options, key=lambda r: (r[8], r[5] in {"PPLC", "PPLA", "PPLA2"}))
        seats.append([f"LT:{unit}", row[0], name, row[2], row[3], "LT", admin2[unit]])

    counts = collections.Counter(row[5] for row in seats)
    assert counts["LT"] == 60
    by_tile = collections.defaultdict(list)
    for row in seats:
        by_tile[tile_id(row[3], row[4])].append(row)
    output = {"snapshot": index["snapshot"], "source": "GeoNames CC BY 4.0",
              "counts": counts, "tiles": by_tile}
    with gzip.open(DATA / "centers-index.bin", "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))
    print("centers", len(seats), "countries", len(counts), "LT", counts["LT"])


if __name__ == "__main__":
    main()
