# SOC Radar - Systemarchitektur & Kontext

## 1. Systemarchitektur & Datenfluss (Pipeline)
Die Pipeline besteht aus 5 Stationen:
- **Log-Quelle:** Ubuntu-Systemdateien (`/var/log/auth.log`, `/var/log/xrdp-sesman.log`) oder `journalctl`.
- **Phase 1 (SOC-Collector):** Ein lokales Node.js-Skript, das die Logs in Echtzeit mitliest.
- **Datenbank:** Eine lokale MariaDB (`soc_radar`), die alle geparsten Events historisch speichert.
- **Phase 2 (SOC-Gateway):** Ein lokaler Node.js Express/Socket.io-Server (Port 3001), der als Brücke dient. Er wird über einen Tailscale Funnel (https://heimserver.tail2ad9cd.ts.net) sicher mit gültigem SSL-Zertifikat für das öffentliche Internet freigegeben.
- **Frontend (Vercel):** Ein Next.js-React-Dashboard, das sich beim Start die Historie via REST-API holt und danach per WebSocket (Socket.io) auf Live-Events lauscht.

## 2. Wichtige Umgebungsvariablen (.env)
- **Datenbank (Collector & Gateway):** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- **Sicherheit (Backend):** `INTERNAL_API_KEY` (Ein geheimes Passwort, mit dem der Collector dem Gateway neue Events meldet. Schützt die interne Route vor Fremden).
- **Sicherheit (Frontend Login):** `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `TOTP_SECRET` (Für die 2-Faktor-Authentifizierung mit Microsoft Authenticator).
- **Frontend-Verbindung (Vercel):** `NEXT_PUBLIC_API_URL` (Muss exakt auf die HTTPS-URL des Tailscale-Funnels zeigen, ohne Schrägstrich am Ende. Teilt dem Frontend mit, wo das Gateway wohnt).

## 3. Kernmodule & Hauptfunktionen

### A. SOC-Collector (Backend Phase 1)
- `startCollector()`: Spawnt einen Linux-Prozess (tail oder journalctl), um Logdateien zeilenweise zu lesen.
- `parseLine()`: Nutzt Reguläre Ausdrücke (Regex), um Textzeilen in strukturierte Events (`event_type`, `ip_address`, `targeted_user`) zu übersetzen. Erkennt `SSH_FAILED`, `SSH_SUCCESS`, `FAIL2BAN_BLOCK`, `FAIL2BAN_UNBLOCK`, `XRDP_FAILED` und `FTP_FAILED`.
- `enrichWithGeo()`: Nimmt die IP-Adresse und wandelt sie per lokaler GeoIP-Datenbank in Längen- und Breitengrade (`latitude`, `longitude`), Land und Stadt um.
- `insertEvent()`: Speichert das fertige Datenpaket in der MariaDB.
- `notifyGateway()`: Feuert einen HTTP POST-Request an das Gateway (`/internal/notify`), um das Event sofort und ohne Verzögerung in den Live-Stream einzuspeisen.

### B. SOC-Gateway (Backend Phase 2)
- **CORS-Management:** Ist so konfiguriert (`origin: "*"`), dass das Vercel-Frontend Anfragen stellen darf, ohne von Browser-Sicherheitsrichtlinien blockiert zu werden.
- `GET /api/events/recent`: Eine REST-Route, die dem Frontend beim initialen Laden die letzten 100-500 Events aus der Datenbank schickt.
- `GET /api/events/stats`: Berechnet Statistiken für das Dashboard (z.B. Angriffe der letzten 24 Stunden, Top-10 Angreifer-IPs).
- `POST /internal/notify`: Empfängt Daten vom Collector, prüft den `INTERNAL_API_KEY` und nutzt dann `io.emit('new_event')`, um die Daten per WebSocket an alle offenen Dashboards zu funken.
- `POST /api/auth/verify`: Vergleicht den vom User eingegebenen 6-stelligen Code mit dem generierten `TOTP`-Secret für den 2FA-Login.

### C. Dashboard Komponenten (Next.js Frontend)
- **GlobeRadar (Three.js):** Eine interaktive 3D-Weltkugel. Hat die Funktion `getCoordinates()`, um Längen-/Breitengrade in 3D-Koordinaten umzurechnen. Zeichnet rote/lila Laser und ballistische Angriffsbögen auf die Koordinaten der Hacker.
- **TerminalFeed:** Ein Matrix-ähnliches Live-Terminal. Nimmt jedes neue Event per WebSocket an und scrollt automatisch nach unten. Unbekannte Event-Typen erhalten den Fallback `UNKNOWN`.
- **AlertTable:** Eine filterbare HTML-Tabelle mit Status-Badges (Farben) für die verschiedenen Angriffsarten.
- **MetricsRow:** Animierte SVG-Ringe, die die Gesamtstatistiken visualisieren (Total Events, Failed Logins, Active Blocks, Unique Countries).

## 4. Aktueller Systemstatus (Zuletzt gespeichert)
- **Server:** Ubuntu-Server läuft, Prozesse werden via `pm2` (`soc-collector`, `soc-gateway`) stabil im Hintergrund gehalten.
- **Netzwerk:** Tailscale Funnel läuft erfolgreich. Lokaler Port 3001 wird sauber per HTTPS und SSL-Zertifikat nach außen getunnelt.
- **Frontend:** Auf Vercel gehostet. Der "Network error" (CORS und falsche Environment Variable) wurde behoben.
- **Erweiterungen (Next Steps):** Das Backend liest nun erfolgreich XRDP (`/var/log/xrdp-sesman.log`) und FTP-Logs aus. Als Nächstes müssen dem Frontend-Code in Vercel diese neuen Typen (`XRDP_FAILED`, `FTP_FAILED`) beigebracht werden, indem die `TYPE_STYLE`-Farbmappings und Filter-Buttons (z.B. in Fuchsia und Pink) in den React-Komponenten ergänzt werden.
