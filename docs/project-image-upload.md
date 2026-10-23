# Project gallery uploads (2026-10-23)

The browser now posts multipart FormData (`file`) to
`https://garanti-group-ai.suloanani1.workers.dev/api/upload` with
`Authorization: Bearer <Firebase ID token>`. A successful response must be
`{"url":"https://<project>.supabase.co/storage/v1/object/public/project-images/projects/<uuid>.png"}`
(also jpg/webp). The returned URL is saved in Firestore `site/content`.
Legacy Firebase project image URLs remain readable. Inquiry/order attachments
remain private Firebase Storage objects; `storageEnabled: false` still means
inquiry photo submission is disabled. Do not enable that flag for gallery uploads.

## Required production Worker change

**This repository's Worker is older than the deployed Worker. Do not deploy
`ai-worker/worker.js` wholesale over production.** Production health reports
Gemma, while the repository chat handler uses GLM. Keep the deployed AI chat,
catalog, health and any other routes, bindings, model and prompt unchanged.

Copy `ai-worker/project-upload.js` into the deployed Worker's source project,
import it, and route `/api/upload` to it **before the current upload auth/claim
guard and generic OPTIONS handling**:

```js
import {projectUpload} from './project-upload.js';
// At the start of the existing fetch(request, env):
if (new URL(request.url).pathname === '/api/upload') {
  return projectUpload(request, env);
}
// Leave all other existing handlers below intact.
```

The repository Worker contains this integration for testing/reference. Deploy
only the merged production version. There is no automatic Worker deployment in
the Pages workflow.

Use existing Worker settings `SUPABASE_URL` and secret
`SUPABASE_SERVICE_ROLE_KEY` (map existing differently named secrets if needed).
Never place the service role key in browser configuration. The `project-images`
bucket must exist and be public for reading; keep client INSERT/UPDATE/DELETE
policies denied. No order images belong in this bucket.

## Authorization

Existing website authorization is **`admins/{uid}.active == true`**, not a
custom JWT `admin` claim. Do not grant or invent claims in the browser. The
handler passes the bearer token to Firestore REST when reading that exact admin
document in project `garanti-group`. Firestore verifies the Firebase token's
signature and applies the deployed rules (self-only admin document reads,
client role writes denied). Decoded JWT fields are only preliminary rejection
checks, never proof of identity. A forged token or a claim-only administrator
cannot authorize an upload. Inactive/missing roles fail closed; authorization
service failures fail closed. The role is checked for every upload without a
role cache. Keep the existing Firestore rules deployed.

References: [Firestore REST Firebase-token authorization](https://firebase.google.com/docs/firestore/use-rest-api),
[Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

## Verification and remaining production check

Local tests exercise the real browser helper and Worker handler together with
mocked Firestore/Supabase responses, validating multipart bytes, bearer token,
server-only credentials, active roles, failures, MIME signatures, size limits,
public URLs and the existing chat route. They do not prove a production upload.

Live probes on 2026-10-23: `/health` returns `status:ok`, `aiBinding:true`,
`storageConfigured:true`, model `@cf/google/gemma-4-26b-a4b-it`;
unauthenticated `/api/upload` returns 401; preflight allows Authorization.
An unsigned forged `admin:true` token returns 401 `INVALID_TOKEN`.
Neither result proves the deployed role check, request format or successful
Supabase write. No Cloudflare authenticated session/API credentials or Firebase
admin session were available in the task environment. The deployed source's
custom claim guard could not be inspected; it must be replaced/confirmed as
described above before calling the migration complete.

After merging and deploying the Worker patch, sign into the admin page with an
existing active Firebase administrator. Save a small PNG project photo; require
HTTP 200 with the expected URL, open the URL publicly, reload the site and admin
to confirm persistence. Verify inactive and ordinary authenticated accounts are
denied, then confirm AI chat and existing orders still load. Do not publish real
customer/order photos for this test.
