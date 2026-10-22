# Firebase integration — garanti-group

The website now uses Firebase Authentication + Cloud Firestore directly from GitHub Pages when `GG_CONFIG.firebase` is present. The legacy Node CMS remains in the repository as an alternative; the public site no longer uses it. The existing Cloudflare AI chatbot has not been modified.

## Current setup

- Project: `garanti-group`, `(default)` Firestore Standard database, Frankfurt `europe-west3`.
- Email/Password for the administrator; Anonymous Auth for guest inquiry ownership.
- `site/content` holds public marketing text, safe links and published projects.
- `orders/{id}` holds private contact details, state and timestamps. `items/{0..19}` holds independently validated construction details.
- Admin grants are `admins/{Firebase Auth UID}` with Boolean `active: true`. All client writes to these grants are forbidden. New signups/anonymous users cannot assign themselves an admin role.
- No password is stored in the repository, local storage or source configuration. Auth sessions are in memory and end on page reload.
- `storageEnabled: false`: Firebase Console currently requires upgrading the Spark project to Blaze to provision Storage. Text-only inquiry submissions work once Auth and Firestore Rules are published. Selecting photos gives an explicit error before creating a record; local download still includes photos.

## First administrator — user action required

1. In Firebase Console → Authentication → Users → Add user, enter your chosen email and password **yourself**. Do not send the password in chat.
2. Copy that user's UID (not password).
3. In Firestore Data, create collection `admins`, document ID exactly that UID, field `active` with type **boolean** and value `true`. This is a trusted Console operation; the website cannot grant its own privileges.
4. Open `https://teslamap.github.io/garanti-group/admin.html` and sign in with that email/password.

The admin can publish public texts/links/projects and inspect/status/delete private inquiries. `მზადდება` is an incomplete upload/reservation and is distinguished from a submitted `ახალი` inquiry. The same draft ID is reused on retry within the current page session. Admin status edits cannot impersonate the customer's final submission. Inquiry deletion deletes the photo objects first, then all item documents and the header. Deleted gallery references leave their old public files for manual retention cleanup.

## Rules, validation and tests

`firestore.rules` and `storage.rules` deny unspecified paths, constrain inquiry schema and sizes, keep ownership/timestamps immutable, forbid self-admin grants, scope object paths to the order/owner/item and cap image content types/sizes. Firestore's UID cooldown permits one reservation/minute per UID; it does **not** prevent abuse by rotating anonymous accounts. Configure App Check and enforce it for Firestore/Storage before a broad launch. Do not enable open test-mode rules.

Rules are a **prototype** requiring review before broad use. Emulator attack tests in `tests/firebase-rules.integration.mjs` exercise private listing/reads, role escalation, invalid items, foreign images, immutable ownership and status, and repeat reservations. The Pages workflow runs these tests before deploying. `node --test` runs input validation and existing backend/pricing/AI tests. Rules publication in Console also validates syntax. Saving source files does not deploy Firebase Rules.

To deploy from an authenticated Firebase CLI:

```
npx -y firebase-tools@latest deploy --only firestore:rules --project garanti-group
```

## Activate photos after billing setup

Only the project owner should connect a billing account. Provision Storage in Firebase Console, deploy the included `storage.rules`, and enable the cross-service Firestore checks when Firebase asks. Set bucket CORS for authenticated browser photo downloads using `storage.cors.json`:

```
gcloud storage buckets update gs://garanti-group.firebasestorage.app --cors-file=storage.cors.json
npx -y firebase-tools@latest deploy --only storage --project garanti-group
```

Set `GG_CONFIG.storageEnabled` to `true` only after the bucket/rules/CORS are ready. Public gallery photos get public URLs. Private inquiry photos use authenticated blob downloads, **not** reusable download-token URLs. Supported images are JPG/PNG/WebP, max 1.5 MB per photo; each inquiry item allows 3 and each public project 5. Inquiry photo total is capped at approximately 11 MB binary. For larger traffic, use upload scanning and enforced App Check, and define a retention/backup policy. The project remains on Spark until the owner explicitly upgrades it.

The existing chatbot has not yet been connected to Firebase marketing content; no private inquiry data is sent to the chatbot by this integration.
