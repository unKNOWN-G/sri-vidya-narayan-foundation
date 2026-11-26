# Private photo uploader — no Meta or Facebook account

## Current state

The upload page, private Cloudflare Worker/D1 inbox, photo importer and GitHub Pages workflow are implemented and locally tested. Cloudflare deployment and remote database setup are complete. The deployed uploader is https://swamiji-website-updates.foundation-private-photo-uploader.workers.dev/ . The local development preview remains `http://localhost:8790/`.

**Publishing remains disabled.** Cisco Umbrella blocks the deployed uploader hostname on the setup computer's network, preventing a live login/upload/deployment test. The network administrator must allow this hostname, or approve another hosting destination, before testing can continue here. Do not bypass the network control. The Cloudflare password hash and internal secret are configured, and GitHub has the matching `UPLOADER_INTERNAL_TOKEN` secret and `UPLOADER_URL` variable. A repository-limited GitHub dispatch token is prepared but awaits the owner's separate approval before creation and storage. No sample occasion has been published.

Existing uncommitted changes in the shared website checkout are independent; this implementation does not require committing or reverting them. The website is served by its existing static Pages pipeline. The separate uploader is served by a Worker, rather than putting credentials into a GitHub Pages upload form.

## Customer workflow

Save the uploader link or pin it in WhatsApp. Unlock it with the private access code, select a section, choose a new or existing occasion, enter the title and caption, and choose photographs. Review the cover and caption, explicitly confirm public release, then select Publish. The page reports success only after GitHub Pages deployment succeeds. There is no Meta login, WhatsApp API, WhatsApp-group monitoring or customer GitHub login.

The first version supports photo occasions in His Holiness, Devotion and Celebration, Vedic Learning, Education, Annadanam and Medical. Books, folded message cards, satsang texts, receipts, video and audio are not generic photo imports and require their existing specialist workflows. A photo of a donation receipt must not be disguised as an ordinary photograph.

## Local development

Use a current Node.js LTS release and Python 3.9+; photo import tests also need `requirements-authoring.txt`.

```
cd services/uploader
npm ci
cd ../..
python3 scripts/uploader_tool.py init
python3 scripts/uploader_tool.py preview
```

The helper can reuse the verified portable Node runtime in ignored `work/uploader-tools/` on this Mac. It generates local-only access credentials in ignored `private/uploader-preview-access.json`, writes ignored `.dev.vars`, and never prints secrets. Use a different access code and internal token for production. Local cookies work over loopback HTTP only because `.dev.vars` explicitly sets `LOCAL_DEVELOPMENT=true`; do not set that variable on a deployed Worker.

```
python3 scripts/uploader_tool.py test
python3 -m unittest discover -s tests
python3 scripts/validate.py
python3 scripts/check_content_routes.py --require-experiences
```

## One-time free hosting setup

1. Owner signs into Cloudflare and accepts any required terms. Keep the account on Workers Free; do not select a paid plan, R2, paid AI or a custom domain.
2. Run `python3 scripts/uploader_tool.py cloudflare-login`. The owner approves Wrangler access through the browser. This authorisation is distinct from merely signing into the dashboard. The helper requests account/user read, Worker script/route write and D1 write access; billing permissions are excluded.
3. The production database is already configured in `wrangler.toml`; do not recreate it for routine updates. For a separate installation, in `services/uploader` create a D1 database with `npx wrangler d1 create swamiji-upload-inbox`, replace `database_id` with its returned ID, and apply `schema.sql` using `npx wrangler d1 execute swamiji-upload-inbox --remote --file schema.sql`.
4. Generate a strong production access code and store only its SHA-256 hex digest using `npx wrangler secret put PUBLISHER_PASSWORD_HASH`. Generate a separate random secret of at least 32 characters and store it with `npx wrangler secret put INTERNAL_TOKEN`. Share the access code privately with the publisher. Do not put either secret in Git, the public asset directory, chat logs or workflow inputs.
5. Deploy with `python3 scripts/uploader_tool.py deploy`. Use the free `workers.dev` address. Leave publishing disabled while checking login, photo preparation and review.

## Connect GitHub publishing

The new `.github/workflows/upload-photos.yml` must first be on the repository's `main` branch. It accepts one opaque batch UUID, not photos, captions or a token in workflow inputs.

Create a repository-limited fine-grained GitHub token with Actions read/write for **only** `unKNOWN-G/sri-vidya-narayan-foundation`. The owner must authorise this new access; do not reuse or transmit an existing account-wide CLI token to Cloudflare. This token starts the fixed workflow and is stored with `npx wrangler secret put GITHUB_ACTIONS_TOKEN`. It needs no Contents permission. Track its expiry and rotate it before expiry. A repository-installed GitHub App can later replace this token if automatic short-lived credential rotation is desired.

Set the repository Actions variable `UPLOADER_URL` to the deployed HTTPS origin. Set the Actions secret `UPLOADER_INTERNAL_TOKEN` to the **same** value as the Worker's `INTERNAL_TOKEN`. This is the authenticated channel used by the workflow to read only its approved batch and return publishing status. The workflow's own short-lived `GITHUB_TOKEN` commits the prepared content; the customer never receives that token.

Once all secrets are present and the uploader is accessible through an approved network, change `PUBLISH_ENABLED` to `"true"`, deploy, and publish one owner-approved real update. Verify its actual live occasion URL, the private success state and an append to an existing occasion. Do not mark this integration live until that test succeeds. No production publish has been tested.

## Import and publication guarantees

- Browser preparation produces WebP photographs with a maximum edge of 1600 pixels and no carried EXIF/location metadata. The worker accepts only WebP up to 500,000 bytes each, at most 20 photographs / 8 MB per batch. The importer verifies hashes, sizes and actual image decoding again.
- Password-protected, expiring HttpOnly/SameSite sessions guard the inbox. Mutations check same-origin requests. Failed logins are rate limited. No backend credential is embedded in the browser.
- Photographs remain in private D1 storage until explicit confirmation. Only approved derivatives are committed to the public repository. GitHub run names and dispatch inputs contain no titles, phone numbers, source filenames or original documents.
- The inbox limits pending media to 100 MB and updates to 20 per day. Successful jobs delete private photo blobs. Scheduled cleanup removes abandoned drafts and failed-photo batches after three days. This inbox is not an original-media backup.
- Repeated batch imports are idempotent. Appending preserves the occasion's title, date and cover, and skips photographs previously imported through this uploader with the same prepared-image hash. Historical source photographs imported before this uploader may not have matching hashes.
- Education uploads add the required school profile and never create contribution records or infer a donation amount. Dates come only from the optional explicit field.
- One upload job at a time shares the existing `github-pages` deployment lock. The prior site stays live until deployment succeeds. Timed-out or failed work can be retried without creating another occasion. A failed deployment after a successful source commit requires a retry of deployment, not duplicate content.
- Every upload runs source validation, the independent route checker and the existing build. A 900 MiB generated-site guard runs before committing or pushing. A non-fast-forward Git push fails rather than overwriting another editor's work.

## Cost controls and maintenance

Use Workers Free, D1 Free, the existing public repository, standard Linux Actions runners, short-lived deployment artifacts and the free Pages domain. No paid subscription is required within those quotas. Free-service policies can change; check current provider terms before connecting accounts. Keep publishing disabled when any required connection or quota is unavailable. The existing website remains readable if the uploader is paused.

The customer's only credentials are the private upload-page code. The operator handles free hosting, repository access, access-code resets and token rotation. This is a photo-publishing service, not a promise of permanent unlimited free storage.
