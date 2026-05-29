---
'@mastra/server': patch
---

Bumped the `@mastra/core` peer dependency floor on `@mastra/server` to `>=1.39.0-0 <2.0.0-0`.

The runtime tool-provider work in this PR imports `SHARED_BUCKET_ID` and `UnknownToolProviderError` from `@mastra/core/tool-provider`. Those exports first ship in the next minor of `@mastra/core`, so installs of this `@mastra/server` against an older core would resolve to `undefined` at runtime. The floor bump keeps `pnpm --filter ./packages/server check:core-imports` honest.
