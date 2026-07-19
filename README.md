# Dochádzka – PWA

Samostatná appka (Progressive Web App). Po nainštalovaní beží ako ikona na ploche/domovskej obrazovke, bez viditeľného prehliadača, funguje aj offline.

## Obsah appky

- **Prehľad** (hlavná záložka) – kalendár s dovolenkou, dodatkovou dovolenkou, 25h službami, osmičkami, SC/SVa/SVc, PN/OČR, ročné a mesačné súčty, nárok/zostatok dní, hodiny po servisných obdobiach. Presne to, čo bolo v `prehlad-dni_2.jsx`, len dáta sa teraz ukladajú lokálne v prehliadači (predtým to bolo cez `window.storage`).
- **Dnes** – jednoduchý príchod/odchod s výpočtom odpracovaných hodín.
- **História** – prehľad dní, týždenný a mesačný súčet.
- **Export** – CSV export pre mzdy, JSON záloha/import na ručný sync cez iCloud Drive.

## Prečo appku musíš najprv niekam nahrať

iOS aj macOS vyžadujú, aby appka bežala cez **HTTPS**, inak nefunguje offline režim (service worker) a inštalácia na plochu. Najjednoduchšie bezplatné možnosti:

### Možnosť A – Netlify Drop (najrýchlejšie, bez GitHub účtu)
1. Choď na https://app.netlify.com/drop
2. Pretiahni tam celý priečinok `dochadzka-pwa`
3. Dostaneš verejnú https:// adresu – tú otvor v Safari na iPhone aj Macu

### Možnosť B – GitHub Pages (stabilnejšie, vlastná adresa)

Toto je jednorazové nastavenie cez webové rozhranie, žiadny terminál ani znalosť Gitu netreba.

1. **Vytvor si účet.** Choď na https://github.com/signup, zadaj email, heslo, meno používateľa (napr. `viktorb`) – je to zadarmo.
2. **Vytvor nový repozitár.** Po prihlásení choď na https://github.com/new. Do poľa "Repository name" napíš napr. `dochadzka`. Nechaj zvolené **Public**. Nič iné nezaškrtávaj. Klikni zelené tlačidlo **Create repository**.
3. **Nahraj súbory appky.** Na stránke novo vytvoreného repozitára klikni na odkaz **"uploading an existing file"** (alebo hore **Add file → Upload files**). Otvor priečinok `dochadzka-pwa` na svojom počítači a **presuň doň naraz všetky súbory a priečinok `icons` celý** (myšou ich pretiahni do okna prehliadača – GitHub si zachová aj podpriečinok `icons` so správnou štruktúrou). Dole klikni zelené tlačidlo **Commit changes**.
4. **Skontroluj, že sú tam všetky súbory** – `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.json`, `prehlad.bundle.js`, `README.md` a priečinok `icons` s 3 obrázkami. Ak niečo chýba, zopakuj krok 3 len pre chýbajúci súbor.
5. **Zapni GitHub Pages.** Hore v repozitári klikni na záložku **Settings**. V ľavom menu klikni na **Pages**. Pri "Build and deployment" → "Source" vyber **Deploy from a branch**. Pod tým pri "Branch" vyber **main** a priečinok **/ (root)**, klikni **Save**.
6. **Počkaj cca 1 minútu** a obnov stránku (F5). Hore sa zobrazí zelený box s adresou tvaru `https://<tvoj-username>.github.io/dochadzka/` – to je verejná https adresa appky. Otvor ju v Safari na iPhone aj Macu.
7. **Pri budúcich zmenách** (napr. ak ti niekedy niečo doladím) stačí v repozitári znova cez **Add file → Upload files** nahradiť zmenené súbory a znova **Commit changes** – Pages sa automaticky prebuildne.

## Inštalácia na iPhone
1. Otvor adresu appky v **Safari**
2. Ťukni na ikonu zdieľania (štvorček so šípkou hore)
3. **Pridať na plochu**
4. Appka sa objaví ako ikona, spúšťa sa samostatne bez Safari rámu

## Inštalácia na MacBooku
1. Otvor adresu appky v **Safari**
2. Menu **Súbor → Pridať do Docku** (alebo ikona zdieľania → Pridať do Docku, podľa verzie macOS)
3. Appka pobeží ako samostatné okno v Docku

## Synchronizácia dát medzi iPhone a Macom

Appka **nemá automatický sync** (bolo to vedomé rozhodnutie – bez servera, bez Apple Developer účtu). Postup:
1. V appke na jednom zariadení: záložka **Export** → **Exportovať zálohu (JSON)**
2. Súbor ulož/presuň do priečinka v **iCloud Drive**
3. Na druhom zariadení: záložka **Export** → **Importovať zálohu (JSON)** → vyber ten istý súbor
4. Záznamy sa zlúčia podľa ID, nič sa neprepíše duplicitne

Jedna záloha obsahuje obe časti naraz – **Prehľad** (dovolenka/služby) aj **Dnes/História** (príchod-odchod). Pri importe sa dni z Prehľadu zlúčia tak, že importovaný súbor prepíše zhodné dátumy (predpoklad: importuješ z toho zariadenia, kde si naposledy upravoval kalendár). Po importe sa appka automaticky obnoví.

## Technické detaily
- Čistý HTML/CSS/JS + React (zabalený cez esbuild, bez CDN závislostí) – appka je plne offline schopná po prvom načítaní
- Dáta sa ukladajú v `localStorage` prehliadača (zostávajú len na danom zariadení)
- Service worker (`sw.js`) cachuje appku pre offline použitie
