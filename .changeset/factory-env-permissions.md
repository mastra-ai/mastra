---
'create-factory': patch
---

Harden .env handling in create-factory: tighten file permissions and skip git init when .env cannot be gitignored

`.env` files created during scaffolding are now written with `0600` permissions so platform secrets (`MASTRA_PLATFORM_SECRET_KEY`, `DATABASE_URL`) are only readable by the owner. If the scaffolder can't add `.env` to `.gitignore` (e.g. permission denied on `.gitignore`), it now skips `git init` entirely and warns the user, so freshly-minted secrets can't accidentally be committed to the initial commit.
