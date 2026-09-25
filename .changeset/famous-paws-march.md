---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed GitHub plugin installs failing when `package.json` declares pnpm with a Corepack integrity hash, such as `"packageManager": "pnpm@12.6.0+sha512.<hash>"` (the format written by `corepack use`). The hash is now accepted and passed to Corepack, which verifies the downloaded pnpm against it.
