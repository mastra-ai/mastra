# AGENTS.md

## Scope

This file applies to work in `packages/studio-agent-builder/`.

## License

- All source in this package is under the **Mastra Enterprise License**.
- The canonical license text lives at the repo root in `ee/LICENSE`.
- Source files belong in the `ee/` subdirectory, per the root `AGENTS.md` rule:
  _"Any directory named `ee/` is licensed under the Mastra Enterprise License."_

## Runtime gating

- Usage of this package in production requires `MASTRA_EE_LICENSE`.
- Enforcement happens in `packages/server` (`validateAgentBuilderLicense`) at
  server boot — do not duplicate enforcement at call sites.
- Dev and test environments pass freely per the `ee/LICENSE` carve-out.

## Commands

- Build: `pnpm --filter ./packages/studio-agent-builder build`
- Test: `pnpm --filter ./packages/studio-agent-builder test`
- Typecheck: `pnpm --filter ./packages/studio-agent-builder typecheck`
