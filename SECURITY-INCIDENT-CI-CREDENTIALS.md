# Potentially Compromised CI Credentials — easy-day-js Incident (2026-06-17)

Scope: every credential referenced by the GitHub Actions pipeline in `.github/`.
Because the npm org was taken over and malicious versions were published through
the release pipeline, **treat every secret reachable by the publish/release
workflows as potentially exposed** and rotate it.

Release-path workflows (highest exposure): `npm-publish.yml`,
`version-packages.yml`, `cron-alpha-publish.yml`.

> NOTE: The npm publish token itself is **not** referenced by name in any
> workflow file. It is injected via an org-level secret or a self-hosted runner
> `.npmrc`. Find and rotate it in the GitHub org/repo secret settings and/or on
> the runner — it is the single most important credential and is NOT in this repo.

---

## TIER 1 — Release-path / high-privilege. Rotate immediately.

| Credential | Used in | Why it's high risk |
|---|---|---|
| **npm publish token** (not in repo) | publish pipeline (org secret / runner `.npmrc`) | The actual compromise vector. Rotate first. |
| **DANE_APP_PRIVATE_KEY** | npm-publish, version-packages, cron-alpha-publish, backport-auto, issue-pending-release, major-version-check, pr-triage, regenerate-provider-registry, sync-templates, changed-test-gate-labeler | GitHub App private key on the release path; grants repo write/release power. |
| **STUDIO_R2_ACCESS_KEY_ID_PROD** | npm-publish, upload-studio-r2 | Prod storage write creds, exposed to publish job. |
| **STUDIO_R2_ACCESS_SECRET_PROD** | npm-publish, upload-studio-r2 | Prod storage secret, exposed to publish job. |
| **STUDIO_R2_ACCESS_KEY_ID_STAGING** | npm-publish, upload-studio-r2 | Staging storage creds, exposed to publish job. |
| **STUDIO_R2_ACCESS_SECRET_STAGING** | npm-publish, upload-studio-r2 | Staging storage secret, exposed to publish job. |
| **TURBO_TOKEN** | npm-publish + 9 others (most-used secret) | Remote cache token reachable from the publish job and nearly every workflow. |
| **GITHUB_TOKEN** | npm-publish, issue-triage, secrets.test-workspaces, test-combined-stores | Per-run token by default; if a PAT is mapped here, rotate the PAT. Verify. |

## TIER 2 — Privileged PATs / cloud creds (not on release path, but high value).

| Credential | Used in | Why |
|---|---|---|
| **MASTRA_CLOUD_PAT** | trigger-cloud-tests | PAT to Mastra Cloud control plane. |
| **RENOVATE_PAT** | renovate, sync_renovate-changesets | PAT with repo write (opens PRs). |
| **MASTRA_TRIAGE_JWT_KEY** | call-external-mastra-workflow, cron-every-2h, issue-triage | Signing/auth key for triage automation. |
| **GCS_SERVICE_ACCOUNT_KEY** | secrets.test-workspaces | GCP service account key (full JSON). |
| **S3_ACCESS_KEY_ID** | secrets.test-workspaces | AWS access key. |
| **S3_SECRET_ACCESS_KEY** | secrets.test-workspaces | AWS secret key. |
| **ABHI_CLOUDFLARE_API_TOKEN** | prebuild, test-combined-stores, vitest-all | Cloudflare API token. |
| **ABHI_CLOUDFLARE_ACCOUNT_ID** | prebuild, test-combined-stores, vitest-all | Cloudflare account id (paired with token). |
| **KV_REST_API_TOKEN** | vitest-all | KV store auth token. |
| **KV_REST_API_URL** | vitest-all | KV endpoint (paired with token). |

## TIER 3 — Third-party API keys (test workflows). Rotate as precaution.

The easy-day-js payload harvests credentials from any infected machine, so
rotate these even though they are test-only.

| Credential | Used in |
|---|---|
| ANTHROPIC_API_KEY | vitest-all |
| OPENAI_API_KEY | vitest-all |
| OPENROUTER_API_KEY | vitest-all |
| GOOGLE_GENERATIVE_AI_API_KEY | vitest-all |
| COHERE_API_KEY | vitest-all |
| PINECONE_API_KEY | prebuild, test-combined-stores, vitest-all |
| ASTRA_DB_TOKEN | prebuild, test-combined-stores, vitest-all |
| ASTRA_DB_ENDPOINT | prebuild, test-combined-stores, vitest-all |
| E2B_API_KEY | secrets.test-workspaces |
| DAYTONA_API_KEY | secrets.test-workspaces |
| BL_API_KEY | secrets.test-workspaces |
| BL_WORKSPACE | secrets.test-workspaces |
| SLACK_BOT_TOKEN | flag-spam-comments, issue-triage |
| SLACK_TEAM_ID | issue-triage |
| CHANNEL_ID | issue-triage |
| ISSUE_SPAM_PROTECTION_TOKEN | delete-spam-issues |

## LOW PRIORITY — identifiers/config, not secrets (rotate only if paired key rotated).

`TURBO_TEAM`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `TEST_GCS_BUCKET`

---

## Credentials NOT visible in repo — check manually

These are the ones that matter most and cannot be enumerated from `.github`:

1. **npm publish token** — GitHub org/repo Settings → Secrets and variables → Actions
   (likely `NODE_AUTH_TOKEN` / `NPM_TOKEN` / org-level), and any **self-hosted
   runner** `~/.npmrc`.
2. **Org-level GitHub Actions secrets** shared across repos.
3. **Self-hosted runner environment** — tokens baked into the runner host.
4. **npm automation/granular tokens** — visible only in the npm web UI
   (npmjs.com → Access Tokens), not always in `npm token list`.

## Rotation order
1. npm publish token (org secret / runner) + the 3 CLI publish tokens.
2. Tier 1 (release-path + DANE app key + R2 + TURBO_TOKEN).
3. Tier 2 PATs and cloud creds.
4. Tier 3 provider keys.
