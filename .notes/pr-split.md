# PR split scratchpad — v1 tool-provider extensions

Original branch: backup/v1-tool-provider-extensions-original (44 commits)
Working branch: yj/mm/v1-tool-provider-extensions
Base branch: yj/magnificent-marquess
Original PR: #16837

## Planned PRs (stacked)

### PR-A: backend (base = yj/magnificent-marquess)
Branch: yj/mm/v1-tool-provider-backend
- Scope: core, server, editor, stores, client-js, cli generated, examples, notes, changeset
- Adds tool_integration_connections table, runtime resolver, server handlers,
  client-js resource, schemas/types, Composio adapter v2 surface,
  surface-scoped model policy resolver, editor runtime hydration.
- Independently deployable; new routes additive, new table only, no UI shipped.
- Files: 57 non-FE files.
- Verification: pnpm --filter @mastra/core test, @mastra/server test,
  @mastra/editor test, @mastra/libsql test, @mastra/client-js test, builds.

### PR-B: frontend (base = yj/mm/v1-tool-provider-backend)
Branch: yj/mm/v1-tool-provider-frontend
- Scope: packages/playground/** (76 files) — Connections UI, ConnectionPicker,
  ToolProvidersSection, integration row in Tools tab, agent-builder hooks,
  CMS layouts, model-policy-provider context, LLM provider/model gating.
- Hard-depends on PR-A's client-js + route types.
- Verification: pnpm --filter @internal/playground test, build.

## Path-level split rules

FE (PR-B only):
  packages/playground/**

BE (PR-A):
  packages/core/**
  packages/server/**
  packages/editor/**
  packages/cli/src/commands/api/route-metadata.generated.ts
  stores/**
  client-sdks/**
  examples/**
  notes/**
  .changeset/**

## Drift notes

- Local examples edits stashed before split (not part of either PR).
- examples/agent-builder/src/mastra/index.ts is tracked in BE (committed
  example wiring), separate from the stashed local diff.

## Status

- [x] Snapshot backup branch created: backup/v1-tool-provider-extensions-original
- [ ] PR-A branch built + pushed
- [ ] PR-B branch built + pushed
- [ ] PR #16837 description updated to point at the stack
