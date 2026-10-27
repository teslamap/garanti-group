# AI მოთხოვნები

The production frontend is https://teslamap.github.io/garanti-group/ and the authenticated admin panel is `admin.html`.

The widget starts closed. Only the launcher opens it. A dismissible greeting, blue pulse rings and a small vertical movement highlight it; reduced-motion preferences disable animations.

`ai-worker/worker.js` is synchronized from the existing production Worker, preserving chat, Firebase authorization and Supabase uploads/files. Commercial intent uses a keyword fallback and Workers AI classification. The transcript and optional Georgian mobile number are stored in the private Cloudflare D1 `INQUIRIES` binding. The widget discloses this before sending. General greetings are not stored as inquiries.

One random conversation ID maps to one SHA-256 primary key. Atomic SQL upserts prevent duplicate rows on retries and preserve admin status. Older shorter transcripts cannot overwrite newer ones. Chat history is bounded to 20 exchanges; a reset starts a new conversation. Failed AI responses do not lose an already recorded customer request. Requests are limited to 20 per minute per hashed IP bucket; these buckets expire and are cleared on subsequent traffic.

`GET /api/inquiries` returns 50 records and a cursor, `PATCH` changes an allowed status, and `DELETE` clears personal data and leaves an opaque tombstone to prevent recreation by a retry. All three require a Firebase token verified by Firestore and the existing active admin document. Public clients cannot list or read requests. Request content is rendered with textContent.

## Deployment

GitHub main pushes run tests and deploy the frontend through `.github/workflows/deploy-pages.yml`. The existing Worker is deployed through Cloudflare Dashboard, separately from Pages; there was no Worker Git integration configured. Run `node scripts/build-worker.mjs`, then deploy the generated ignored `ai-worker/deploy.js` as the standalone `worker.js` in the dashboard. It includes the helper module. The production D1 binding and database ID are recorded in `ai-worker/wrangler.toml`. Apply `ai-worker/schema.sql` before the first deployment. Preserve the existing AI binding and encrypted Supabase secret.

Tests: `node --test`, including actual SQLite upserts and mocked authenticated Worker routes. GitHub CI also runs the existing Firebase permission emulator suite.
