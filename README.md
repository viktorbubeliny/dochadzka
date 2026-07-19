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

Appka nemá vlastný server – dve možnosti podľa toho, či chceš automatiku alebo nulovú závislosť na cudzej službe.

### Automatický sync cez GitHub Gist (záložka Export)

Dáta appky sa uložia do tvojho **súkromného** GitHub Gistu. Sync nie je real-time (nedeje sa to okamžite pri každom písmenku), ale prebehne automaticky pri otvorení appky (ak zapneš "Auto-sync pri otvorení appky") alebo kedykoľvek stlačíš **Sync teraz**.

**Nastavenie na prvom zariadení:**
1. Vytvor si GitHub token na https://github.com/settings/tokens/new (alebo cez Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token)
2. Nastav mu **iba** scope **`gist`** (nič iné nezaškrtávaj – token nemá mať prístup k repozitárom ani k účtu). Expiráciu si zvoľ podľa seba (napr. "No expiration" alebo 1 rok).
3. Skopíruj vygenerovaný token (zobrazí sa len raz)
4. V appke: záložka **Export** → vlož token do poľa "GitHub token" → **Vytvoriť nový sync (prvé zariadenie)**
5. Zapni **Auto-sync pri otvorení appky**

**Pripojenie druhého zariadenia:**
1. Na prvom zariadení: záložka Export → **Skopírovať sync kód pre druhé zariadenie**
2. Na druhom zariadení: vlož skopírovaný kód do poľa "Vlož sync kód z druhého zariadenia" → **Pripojiť**
3. Zapni tam tiež Auto-sync

**Riziká, o ktorých treba vedieť:**
- Token sa ukladá v prehliadači zariadenia (localStorage) v nešifrovanej podobe. Pri scope obmedzenom len na `gist` je dosah zneužitia obmedzený na tvoje gisty, ale nie je to bezpečnostne "čisté" riešenie ako plnohodnotný backend s autentifikáciou.
- Ak upravíš **ten istý deň** v Prehľade na oboch zariadeniach bez toho, aby si medzitým spustil sync, vyhrá ten záznam, ktorý sa naposledy zapísal do gistu – nie nutne časovo najnovšia úprava. Pre bežné použitie (jeden človek, dve zariadenia) je toto riziko zanedbateľné, ale buď si ho vedomý.
- Fetch volania na `api.github.com` z appky som otestoval logicky (mockované volania), no reálne správanie CORS v Safari si over pri prvom použití – ak by nastal problém, ozvi sa a doriešime to.

### Manuálny export/import (bez GitHub, bez tokenu)

Stále funguje pôvodný spôsob – v záložke Export:
1. Na jednom zariadení: **Exportovať zálohu (JSON)**
2. Súbor presuň cez **iCloud Drive** na druhé zariadenie
3. Tam: **Importovať zálohu (JSON)** → vyber súbor

Jedna záloha obsahuje obe časti naraz – Prehľad aj Dnes/História. Po importe sa appka automaticky obnoví.

## Technické detaily
- Čistý HTML/CSS/JS + React (zabalený cez esbuild, bez CDN závislostí) – appka je plne offline schopná po prvom načítaní
- Dáta sa ukladajú v `localStorage` prehliadača (zostávajú len na danom zariadení)
- Service worker (`sw.js`) cachuje appku pre offline použitie
