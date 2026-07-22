---
'create-factory': patch
---

The Software Factory template now pins every Mastra dep to `"alpha"` instead of a caret range anchored on the current monorepo version. The Mastra Factory sources on `main` are built against the alpha release train — the previous default (`"latest"`) picked up whatever was on the `latest` dist-tag for each package independently, which broke for `@mastra/factory` (still pre-1.0) and produced mismatched trains for the others. `sync-template.mjs` no longer shells out to `npm view` and no longer needs the `--tag` flag. The emitted template ships `.npmrc` with `legacy-peer-deps=true` so npm accepts the internally-consistent prerelease peer graph; both can be flipped back to `"latest"` (and the `.npmrc` deleted) once the packages ship stable releases.
