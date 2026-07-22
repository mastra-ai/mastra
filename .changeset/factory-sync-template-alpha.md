---
'create-factory': patch
---

Make the Software Factory template installable and buildable against published packages so the sync-softwarefactory-template workflow can push it again. Three changes to the generation step:

- Pin every synced Mastra dep to `"alpha"` instead of `"latest"` — the Mastra Factory sources on `main` are built against the alpha release train, and the previous `"latest"` default mixed release trains (worse, `@mastra/factory@latest` is currently an empty stub).
- Emit `.npmrc` with `legacy-peer-deps=true` so npm accepts the internally-consistent prerelease peer graph (the same relaxation pnpm applies automatically inside the monorepo).
- Downgrade `typescript` from tsgo (v7) to the classic compiler (`^5.9.2`) in the emitted template. The sources happily typecheck under tsgo, but `mastra build` transitively loads TypeScript via `typescript-paths`, which needs the classic `ts.sys` API tsgo doesn't expose. In the monorepo pnpm hoists classic TypeScript from another workspace package, hiding the problem; the standalone template has no hoist.

All three are annotated as temporary in the script and README — remove once the packages ship stable releases and the deployer supports tsgo.
