# Website upgrade — operational status

The GitHub Pages frontend includes the existing site and chatbot, a larger desktop chat, a responsive cinematic project detail dialog, type-filtered real project galleries when populated, and a repeatable construction inquiry form. Project records support type, city, description and up to 5 real photos. Each inquiry item has type, material, dimensions in **millimetres**, quantity, notes and up to 3 photos. JPG/PNG/WebP only, max 1.5 MB each. Up to 20 items; total request max 16 MB. Download is local and is explicitly not a submission.

## Activate the backend

GitHub Pages cannot run Node or SQLite. The included `cms.mjs` is connected to the existing Node server; it is **not deployed by Pages**. Deploy this repository on a Node 24+ HTTPS host with a persistent disk. Set:

- `ADMIN_PASSWORD`: a unique random password of at least 16 characters, stored only as a server secret.
- `ALLOWED_ORIGIN=https://teslamap.github.io`
- `DATA_DIR`: the persistent disk directory; never use the public web root.
- `HOST=0.0.0.0` and the platform's `PORT`.

Start with `node server.mjs` (existing AI secrets remain independent). Set `site-config.js` `apiBase` to that HTTPS host, then push main again. Do not place a password/token/API secret in this public file. Until configured, inquiry submission and admin login show an explicit unavailable state; no false confirmation is given. The existing Cloudflare chatbot endpoint is preserved.

Open `/garanti-group/admin.html`, sign in, edit page text and contacts, choose each project's type and city, add up to 5 photos, and publish. The gallery stays empty until actual projects are published; it contains no sample project cards or generated portfolio photos. Project cards open a dark, responsive detail dialog with photo, type, city and description. Changes are stored server-side and visible to all visitors. Admin supports order inspection, photos, status changes and permanent deletion. Sessions last one hour and remain only in browser memory. No public signup/default password. SQLite persists orders, photos and content in `cms.sqlite` using parameterized queries; order photos are never served publicly. Public project photos are deliberately public.

## Operations and limits

Use a trusted HTTPS reverse proxy with body-size limits and durable per-client rate limiting/CAPTCHA before production marketing. The built-in per-minute limits use the socket IP (shared behind a proxy) and reset on process restart. No email/SMS delivery, customer accounts, automated quotes, antivirus scanning or resumable uploads are provided. Project photo data is stored in SQLite, suitable for a small catalog; migrate large media catalogs to private object storage with signed access for order photos. Back up the SQLite database with a SQLite-aware backup process (WAL mode); restrict persistent-disk access and define an inquiry retention period. Admin deletion removes the active record; backup retention must be handled separately. Losing the disk loses data. Existing Render configuration must be given the persistent disk and secrets before CMS use. This task does not provision a cloud account or claim backend activation.

Frontend: GitHub Pages workflow publishes only the required public assets. Backend validation/auth tests: `npm test`. Changes to existing layout, logo, contact information and AI integration are intentionally bounded.
