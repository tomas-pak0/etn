# Data build

Download `allCountries.zip`, `countryInfo.txt`, `admin1CodesASCII.txt` and `admin2Codes.txt` from https://download.geonames.org/export/dump/ into the same directory as these scripts. Run `python build.py` and then `python verify_repair.py` against the source snapshot. The verifier scans the original export twice, corrects any tile count mismatch and checks the global total. The scripts expect to be located as `data-tools/` beside `ETN/`; source filenames are resolved relative to the script.
