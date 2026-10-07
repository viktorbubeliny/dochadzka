# Dochádzka – PWA

Samostatná appka (Progressive Web App). Po nainštalovaní beží ako ikona na ploche/domovskej obrazovke, bez viditeľného prehliadača, funguje aj offline.

## Obsah appky

- **Prehľad** (hlavná záložka) – kalendár s dovolenkou, dodatkovou dovolenkou, 25h službami, osmičkami, SC/SVa/SVc, PN/OČR, ročné a mesačné súčty, nárok/zostatok dní, hodiny po servisných obdobiach. Presne to, čo bolo v `prehlad-dni_2.jsx`. Dáta beží cez `window.storage` (od v2.0 definované v `cloud-sync.js` – localStorage + automatický Supabase push/pull), bundle samotný sa nemenil.
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

### Automatický cloud sync cez Supabase (od verzie 2.0)

Appka má vlastný cloud účet cez **Supabase** (projekt "Dochádzka", viazaný na Viktorov Supabase účet). Prihlasovanie je bez hesla – magic link na email. Dáta sa ukladajú do tabuľky `backups` (jeden riadok na používateľa, stĺpec `data` typu `jsonb` – presne tá istá štruktúra ako predtým `exportJson()`/`buildBackupObject()` produkovali pre GitHub Gist). Push sa deje debounced (~1,5s po zmene), pull pri otvorení appky + cez Supabase Realtime subscription (zmena na jednom zariadení sa prejaví na druhom automaticky, appka sa po novom pulle sama obnoví – `location.reload()`).

**Kľúčové súbory:**
- `cloud-sync.js` – celá Supabase vrstva: auth (magic link), `window.storage` shim pre Prehľad (React bundle, nezmenený), debounced push, realtime pull, auth gate (`#authOverlay` / `#appRoot` v `index.html`)
- `app.js` – `buildBackupObject()`/`applyRemoteBackup()` ostali zdieľané s manuálnym exportom/importom; exponované na `window.__buildBackupObject` a `window.__applyRemoteBackupIfChanged` pre `cloud-sync.js`

**Supabase config (ak treba znova nastaviť/migrovať projekt):**
```sql
create table public.backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.backups enable row level security;
create policy "select own backup" on public.backups for select using (auth.uid() = user_id);
create policy "insert own backup" on public.backups for insert with check (auth.uid() = user_id);
create policy "update own backup" on public.backups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.backups;
```
V Supabase dashboarde (Authentication → URL Configuration) musí byť nastavená Site URL / Redirect URL na `https://viktorbubeliny.github.io/dochadzka/`, inak magic link presmeruje zle.

**GitHub Gist sync (verzie 1.x) je úplne odstránený** – appka už nepoužíva žiadny GitHub token ani Gist. Dôvod zmeny: tokeny expirovali, fine-grained vs. classic token typ mýlil, 403/401 chyby boli ťažko diagnostikovateľné bez priameho prístupu k GitHub API odpovediam. Supabase dáva skutočné prihlásenie a priebežný (takmer real-time) sync bez manuálnej správy tokenov.

### Manuálny export/import (bez GitHub, bez tokenu)

Stále funguje pôvodný spôsob – v záložke Export:
1. Na jednom zariadení: **Exportovať zálohu (JSON)**
2. Súbor presuň cez **iCloud Drive** na druhé zariadenie
3. Tam: **Importovať zálohu (JSON)** → vyber súbor

Jedna záloha obsahuje obe časti naraz – Prehľad aj Dnes/História. Po importe sa appka automaticky obnoví.

## Aktualizácia appky na novú verziu

1. Na GitHube: **Add file → Upload files** → nahraj zmenené súbory → **Commit changes**
2. Počkaj ~1 minútu na prebuild GitHub Pages
3. Otvor appku – od verzie 1.2 sa nové súbory stiahnu automaticky pri najbližšom otvorení s internetom (starší cache-first mechanizmus, ktorý vedel zaseknúť starú verziu, je nahradený network-first stratégiou)
4. **Ktorá verzia mi beží?** Pozri spodok záložky **Export** – je tam číslo verzie (napr. „Dochádzka v1.2"). Ak nesedí s očakávanou, zavri appku úplne a otvor znova, prípadne v Safari na adrese appky urob Cmd+Option+R.

Pozn.: prechod zo starej verzie (v1.x s cache-first) na v1.2 ešte vyžaduje jeden ručný hard-refresh (Cmd+Option+R v Safari na adrese appky, na iPhone: Nastavenia → Safari → Vymazať históriu a dáta stránok, alebo appku odinštalovať a pridať na plochu znova). Od v1.2 ďalej už to bude automatické.

## Technické detaily
- Čistý HTML/CSS/JS + React (zabalený cez esbuild, bez CDN závislostí) – appka je plne offline schopná po prvom načítaní
- Dáta sa ukladajú v `localStorage` prehliadača (zostávajú len na danom zariadení)
- Service worker (`sw.js`) cachuje appku pre offline použitie
