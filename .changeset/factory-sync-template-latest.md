---
'create-factory': patch
---

The Software Factory template now pins every Mastra dep to `"latest"` instead of a caret range anchored on the current monorepo version, matching how every other create-mastra template ships. `sync-template.mjs` no longer shells out to `npm view` and no longer needs the `--tag` flag or the `legacy-peer-deps=true` `.npmrc` (which only existed to work around prerelease pins). The sync workflow no longer breaks whenever a linked package sits mid-alpha between publishes.
