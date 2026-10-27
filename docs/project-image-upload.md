# Public project gallery: GitHub uploads (2026-10-27)

The existing admin photo picker posts multipart FormData to the configured
Worker /api/upload with a fresh Firebase ID token. Firestore verifies the token;
admins/{uid}.active must be true. JPG, PNG and WebP signatures are checked and
each image is limited to 1,500,000 bytes.

The Worker creates uploads/projects/<uuid>.<extension> on main in
 teslamap/garanti-group. Repository, branch, and paths cannot be supplied by the
browser. Each photo gets a public raw.githubusercontent.com URL pinned to its
commit, saved in Firestore site/content. Upload commits use [skip ci] because
raw image URLs work without rebuilding Pages. Existing files are never replaced.

## Required secret

Add PROJECT_IMAGES_GITHUB_TOKEN as an encrypted Cloudflare Worker Secret.
Use a fine-grained token restricted to teslamap/garanti-group, with Contents:
Read and write and an appropriate expiration. No Workflows or account-wide
permission is needed. Never place it in browser code, committed files, or chat.

With no secret, uploads fail closed with GITHUB_STORAGE_NOT_CONFIGURED. Access
errors and write conflicts have explicit client messages. /health reports the
provider and projectImagesConfigured, which checks presence only, not validity.

## Preservation and deployment

Existing Supabase and Firebase gallery URLs remain accepted. No files, buckets,
project records or order attachments are moved or deleted. Switching providers
does not restore old missing files. Customer inquiry attachments retain their
existing private workflow; storageEnabled remains false.

Run node --test and node scripts/build-worker.mjs. Deploy the generated
ai-worker/deploy.js through Cloudflare, preserving AI and INQUIRIES bindings and
existing secrets. Production source was inspected against the repository
baseline before this change; the previous GLM/Gemma mismatch warning is obsolete.
GitHub Pages deploys main through the existing workflow. Browser module versions
are updated to load the new URL validator.

## Validation

Local tests cover the real client and production Worker together with mocked
Firestore/GitHub responses: exact bytes, admin enforcement, MIME rejection,
missing credentials, upstream failures, pinned URLs, legacy URLs, retry behavior,
and existing inquiry/chat behavior. They do not prove a production upload.

After the secret and both deployments are ready, sign into an existing active
Firebase admin and publish a small non-sensitive test photo. Require HTTP 201,
a new GitHub file, a publicly readable image, and persistence after reloading
the admin and gallery. Do not declare completion before this live check succeeds.

