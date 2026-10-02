# OPS Portal

Configurable homelab / ops portal with grouped link cards, page miniatures, health checks, optional HTTP Basic Auth, special-content widgets, and uplink telemetry. Built with **Next.js**, **PatternFly 6**, **SQLite**, and **Docker**.

---

## Table of contents / Inhaltsverzeichnis

- [English](#english)
- [Deutsch](#deutsch)
- [License / Lizenz (GPL-2.0)](#license--lizenz-gpl-20)

---

## English

### Features

- **Portal** (`/`): link grid with page miniatures, online status, widgets, uplink panel
- **Left sidebar menu**: filter links by group (`All links`, custom groups, `Ungrouped`)
- **Admin** (`/admin`): manage groups, links, widgets, and global settings
- **HTTP Basic Auth (optional)**: store username/password per link; used for health checks, connection tests, and opening the target
- **Test connection**: Admin button to probe a URL (with or without credentials)
- **Open in new window**: portal clicks open `/go/[id]` in a separate browser window and apply stored credentials when set
- **Health worker**: periodic HTTP checks (`ok` / `degraded` / `down` + latency)
- **Bandwidth**: client download test + rolling average
- **Widgets**: `iframe`, `gauge`, `metric_text`, `html_fragment`
- **Theme**: PatternFly 6 with **red** brand accent and **light / dark** toggle
- **Persistence**: SQLite under `DATA_DIR` (Docker volume `/data`)

### Requirements

- **Docker path**: Docker + Docker Compose
- **Local path**: Node.js 22+, npm

### Step-by-step setup (Docker — recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url> Portal
   cd Portal
   ```

2. **(Optional) Protect admin write APIs**  
   Edit `docker-compose.yml` and uncomment / set:
   ```yaml
   environment:
     DATA_DIR: /data
     ADMIN_TOKEN: change-me
   ```

3. **Build and start the container**
   ```bash
   docker compose up --build -d
   ```

4. **Open the app**
   - Portal: [http://localhost:3000](http://localhost:3000)
   - Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

5. **(If `ADMIN_TOKEN` is set)**  
   In Admin → **Access token**, enter the same value. It is sent as `x-admin-token` on create / update / delete / test requests.

6. **Configure groups, links, and widgets**
   - Create **link groups** (they appear as sidebar menu items)
   - Add **links** and assign each link to a group
   - Optional: set **Auth username / password** and use **Test connection**
   - Add **special content** widgets as needed

7. **Stop / restart**
   ```bash
   docker compose stop
   docker compose start
   # or fully remove containers (data volume is kept):
   docker compose down
   ```

Data is stored in the Docker volume `portal-data`.

### Step-by-step setup (local development)

1. **Clone and enter the project**
   ```bash
   git clone <repository-url> Portal
   cd Portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   Note: `better-sqlite3` needs a working native build toolchain (Python 3, make, g++ / Xcode CLT on macOS).

3. **Create the data directory**
   ```bash
   mkdir -p data
   ```

4. **Start the dev server**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

6. **Production build locally**
   ```bash
   npm run build
   npm start
   ```

### Using the portal

1. Use the **left sidebar** to switch between groups.
2. Click a link card to open the target in a **new browser window** (`/go/[id]`).
3. Links with stored credentials show an **auth** label; credentials are applied on open and during health checks.
4. Toggle **Light / Dark** in the masthead; the choice is stored in the browser.

### Using Admin

| Area | What you can do |
|------|------------------|
| **Groups** | Create / edit / delete groups (sidebar menu items) |
| **Links** | CRUD, assign group, optional preview URL, health-check URL, Basic Auth, **Test connection**, **Open in new window** |
| **Widgets** | CRUD for `gauge`, `iframe`, `metric_text`, `html_fragment` |
| **Settings** | Portal title, health interval, bandwidth payload / samples |

**Auth note:** Credentials are stored in SQLite (suitable for a private homelab). Some browsers block `user:pass@host` URLs; if that happens, the plain URL is opened and the browser may show its own login prompt. The Admin **Test connection** check always validates credentials server-side.

### Configuration

| Variable       | Default   | Description                                      |
|----------------|-----------|--------------------------------------------------|
| `DATA_DIR`     | `./data`  | SQLite database directory                        |
| `ADMIN_TOKEN`  | _(empty)_ | If set, required as `x-admin-token` for writes   |
| `PORT`         | `3000`    | HTTP port (Docker / `next start`)                |

### Useful URLs

| Path | Purpose |
|------|---------|
| `/` | Portal |
| `/admin` | Administration |
| `/go/[id]` | Launch link in the current (new) window |
| `/api/health/summary` | Health overview |
| `/api/groups` | Groups API |
| `/api/links` | Links API |
| `/api/links/test` | Connection test (Admin) |
| `/api/links/[id]/launch` | Launch payload with optional credentials |

### Widget config examples

**Gauge**

```json
{
  "url": "https://example.com/metrics.json",
  "jsonPath": "cpu.usage",
  "unit": "%",
  "min": 0,
  "max": 100
}
```

**Iframe**

```json
{
  "url": "https://play.grafana.org/...",
  "height": 220
}
```

Many sites block embeds via `X-Frame-Options`; the UI then shows an “Open in new tab” fallback.

### License notice (English)

This program is free software; you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation; either version 2 of the License, or (at your option) any later version.**

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of **MERCHANTABILITY** or **FITNESS FOR A PARTICULAR PURPOSE**. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program; if not, see <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html>.

---

## Deutsch

### Funktionen

- **Portal** (`/`): Link-Raster mit Seiten-Miniaturen, Online-Status, Widgets, Uplink-Panel
- **Linkes Seitenmenü**: Links nach Gruppe filtern (`All links`, eigene Gruppen, `Ungrouped`)
- **Admin** (`/admin`): Gruppen, Links, Widgets und globale Einstellungen verwalten
- **HTTP Basic Auth (optional)**: Benutzername/Passwort pro Link; für Health-Checks, Verbindungstest und Öffnen der Zielseite
- **Test connection**: Admin-Button prüft eine URL (mit oder ohne Credentials)
- **Neues Fenster**: Portal-Klicks öffnen `/go/[id]` in einem separaten Browserfenster und wenden gespeicherte Credentials an
- **Health-Worker**: periodische HTTP-Checks (`ok` / `degraded` / `down` + Latenz)
- **Bandbreite**: Client-Download-Test + gleitender Durchschnitt
- **Widgets**: `iframe`, `gauge`, `metric_text`, `html_fragment`
- **Theme**: PatternFly 6 mit **rotem** Markenakzent und **Hell-/Dunkel**-Umschalter
- **Persistenz**: SQLite unter `DATA_DIR` (Docker-Volume `/data`)

### Voraussetzungen

- **Docker-Weg**: Docker + Docker Compose
- **Lokal**: Node.js 22+, npm

### Schritt-für-Schritt-Einrichtung (Docker — empfohlen)

1. **Repository klonen**
   ```bash
   git clone <repository-url> Portal
   cd Portal
   ```

2. **(Optional) Admin-Schreibzugriff absichern**  
   In `docker-compose.yml` setzen / auskommentieren:
   ```yaml
   environment:
     DATA_DIR: /data
     ADMIN_TOKEN: change-me
   ```

3. **Container bauen und starten**
   ```bash
   docker compose up --build -d
   ```

4. **Anwendung öffnen**
   - Portal: [http://localhost:3000](http://localhost:3000)
   - Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

5. **(Falls `ADMIN_TOKEN` gesetzt ist)**  
   Im Admin unter **Access token** denselben Wert eintragen. Er wird als `x-admin-token` bei Anlegen / Ändern / Löschen / Test mitgeschickt.

6. **Gruppen, Links und Widgets konfigurieren**
   - **Link-Gruppen** anlegen (erscheinen als Menüpunkte links)
   - **Links** anlegen und einer Gruppe zuweisen
   - Optional: **Auth username / password** setzen und **Test connection** nutzen
   - Bei Bedarf **Special Content**-Widgets hinzufügen

7. **Stoppen / neu starten**
   ```bash
   docker compose stop
   docker compose start
   # oder Container entfernen (Volume mit Daten bleibt erhalten):
   docker compose down
   ```

Die Daten liegen im Docker-Volume `portal-data`.

### Schritt-für-Schritt-Einrichtung (lokale Entwicklung)

1. **Projekt klonen und öffnen**
   ```bash
   git clone <repository-url> Portal
   cd Portal
   ```

2. **Abhängigkeiten installieren**
   ```bash
   npm install
   ```
   Hinweis: `better-sqlite3` braucht eine native Build-Umgebung (Python 3, make, g++ / auf macOS Xcode Command Line Tools).

3. **Datenverzeichnis anlegen**
   ```bash
   mkdir -p data
   ```

4. **Dev-Server starten**
   ```bash
   npm run dev
   ```

5. **Öffnen**: [http://localhost:3000](http://localhost:3000)

6. **Lokaler Produktionsbuild**
   ```bash
   npm run build
   npm start
   ```

### Portal bedienen

1. Über die **linke Sidebar** zwischen Gruppen wechseln.
2. Link-Karte anklicken → Ziel öffnet sich in einem **neuen Browserfenster** (`/go/[id]`).
3. Links mit Credentials zeigen ein **auth**-Label; Credentials greifen beim Öffnen und bei Health-Checks.
4. **Light / Dark** in der Kopfzeile umschalten; die Wahl wird im Browser gespeichert.

### Admin bedienen

| Bereich | Möglichkeiten |
|---------|----------------|
| **Groups** | Gruppen anlegen / ändern / löschen (Menüpunkte der Sidebar) |
| **Links** | CRUD, Gruppe zuweisen, optionale Preview-/Health-URL, Basic Auth, **Test connection**, **Open in new window** |
| **Widgets** | CRUD für `gauge`, `iframe`, `metric_text`, `html_fragment` |
| **Settings** | Portal-Titel, Health-Intervall, Bandwidth-Payload / Samples |

**Auth-Hinweis:** Credentials liegen in SQLite (für privates Homelab gedacht). Manche Browser blockieren `user:pass@host`-URLs; dann wird die normale URL geöffnet und ggf. der Browser-Login-Dialog gezeigt. **Test connection** prüft Credentials immer serverseitig.

### Konfiguration

| Variable       | Standard  | Beschreibung                                       |
|----------------|-----------|----------------------------------------------------|
| `DATA_DIR`     | `./data`  | Verzeichnis für die SQLite-Datenbank               |
| `ADMIN_TOKEN`  | _(leer)_  | Wenn gesetzt, Pflicht-Header `x-admin-token` (Schreiben) |
| `PORT`         | `3000`    | HTTP-Port (Docker / `next start`)                  |

### Wichtige URLs

| Pfad | Zweck |
|------|--------|
| `/` | Portal |
| `/admin` | Verwaltung |
| `/go/[id]` | Link in diesem (neuen) Fenster starten |
| `/api/health/summary` | Health-Übersicht |
| `/api/groups` | Gruppen-API |
| `/api/links` | Links-API |
| `/api/links/test` | Verbindungstest (Admin) |
| `/api/links/[id]/launch` | Launch-Daten inkl. optionaler Credentials |

### Widget-Config Beispiele

**Gauge**

```json
{
  "url": "https://example.com/metrics.json",
  "jsonPath": "cpu.usage",
  "unit": "%",
  "min": 0,
  "max": 100
}
```

**Iframe**

```json
{
  "url": "https://play.grafana.org/...",
  "height": 220
}
```

Viele Seiten blockieren Embeds via `X-Frame-Options` — dann erscheint der Fallback-Link.

### Lizenzhinweis (Deutsch)

Dieses Programm ist freie Software. Sie können es unter den Bedingungen der **GNU General Public License, wie von der Free Software Foundation veröffentlicht, weitergeben und/oder modifizieren; entweder Version 2 der Lizenz oder (nach Ihrer Wahl) jede spätere Version.**

Die Veröffentlichung dieses Programms erfolgt in der Hoffnung, dass es Ihnen von Nutzen sein wird, aber **OHNE JEDE GEWÄHRLEISTUNG** — sogar ohne die implizite Gewährleistung der **MARKTREIFE** oder der **EIGNUNG FÜR EINEN BESTIMMTEN ZWECK**. Details finden Sie in der GNU General Public License.

Sie sollten eine Kopie der GNU General Public License zusammen mit diesem Programm erhalten haben. Falls nicht, siehe <https://www.gnu.org/licenses/old-licenses/gpl-2.0.html>.

---

## License / Lizenz (GPL-2.0)

```
OPS Portal
Copyright (C) 2026

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
```

Full license text: see [`LICENSE`](LICENSE) and [GNU GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html).
