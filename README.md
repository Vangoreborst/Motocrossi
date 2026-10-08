# Tammisaari Motocross v4

2D-sivunäkymäpeli (Canvas), toimii Chromessa puhelimella ja tietokoneella.
Tietokoneella hiiren vasen klikkaus = näpäytys. Nuolinäppäimet / A / D ohjaavat lennossa, välilyönti = klikkaus.

## Käynnistys (Windows / VS Code)
```powershell
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --reload
```
Avaa http://127.0.0.1:8000

## Render
`render.yaml` on mukana. Lisää `.venv` GitHubissa .gitignoreen (valmiina) ja yhdistä repo Renderiin.

## Pelin kulku
1. Valitse kuski ja kulkuneuvo (prätkä, ruohonleikkuri, mönkijä, sähköpotkulauta – ominaisuudet samat, vain ulkonäkö ja ääni eroavat) ja paina Jatka.
2. Pidä START pohjassa → moottori käynnistyy.
3. 15 s tuulen seurantaa → LÄHDE! kun tuuli on vihreä.
4. Vauhdinotto 6 s (100 km/h on maksimi, vaatii noin 8–9 klikkausta sekunnissa): klikkaa mahdollisimman nopeasti. Nopeus seuraa klikkaustahtia, mutta myös klikkausten kokonaismäärä lasketaan.
5. Nopeus lukittuu. Pienen viiveen jälkeen tulee kolme ympyrää (seisomaan, taakse, kyykkyyn): klikkaa kun keltainen rengas osuu vihreään.
6. Hyppyri ilmestyy näkyviin – ponnista klikkaamalla juuri ennen keulaa.
7. Lennossa pidä ◀ ▶ -painikkeilla prätkä balansissa. Nokka nousee koko ajan ylös, joten alas painaminen (▶) on tarpeen.

## Asetukset
Kaikki parametrit löytyvät valikon Asetukset-näkymästä (ajat, nopeus, painot, lennon fysiikka, kamera).
Matka = 100 m · (painotettu suoritus)^vaikeuskäyrä · tasapainokerroin.
Uusia ratoja voi lisätä `TRACKS`-taulukkoon `static/game.js`-tiedostossa.

## Äänet
Kaikki äänet syntetisoidaan selaimessa (WebAudio), ei äänitiedostoja. Ääni käynnistyy ensimmäisestä klikkauksesta. Vasemman yläkulman 🔊-nappi mykistää.
