# OpenAI strict schema compatibility

## Origin PR / commit

- PR: [#13695](https://github.com/mastra-ai/mastra/pull/13695) — fixed OpenAI strict-mode schema rejection for agent networks and workspace/tool schemas.
- Later changes: [#14157](https://github.com/mastra-ai/mastra/pull/14157) — adds generic Zod v4 Standard Schema JSON Schema export support that feeds the provider-specific strict-schema paths.

## User-visible behavior

- What the user can do: use OpenAI models with structured output, agent-network completion checks, and workspace tools without OpenAI rejecting schemas for missing required keys or `additionalProperties` flags.
- Success looks like: optional/default/nullish Zod fields remain usable while emitted OpenAI strict schemas include every object property in `required` and set `additionalProperties: false` recursively.
- Must preserve: OpenAI-specific compatibility should apply even when `modelId` is undefined/empty but provider identifies OpenAI, without crashing non-OpenAI providers.

## Entry points / commands

- Commands / shortcuts / flags: automatic through agent runs, structured output calls, workspace tool calls, and model routing.
- Automatic triggers: core stream execution enables OpenAI `strictJsonSchema` for OpenAI JSON response formats unless prompt-injection mode is requested.

## TUI states

- Idle: no direct UI.
- Active / modal / error: failures appear as model/tool/schema errors during the active run; the fix should prevent OpenAI 400-style strict-schema rejections for known compatible schemas.

## Headless / non-TUI behavior

- Supported: same core agent/schema path applies to headless `--prompt` runs.
- Not supported / unknown: live OpenAI e2e coverage exists but depends on external credentials and is not part of narrow local verification.

## Streaming / loading / interrupted states

- Streaming / loading: schema compatibility is applied before the model request starts.
- Abort / retry / resume: no separate resume state; failed schema requests surface as run/tool errors.

## Streaming vs loaded-from-history behavior

- While actively streaming: strict schema is prepared for the outbound model request.
- After reload / history reconstruction: completed output/history is unaffected; only future model requests use the compatibility path.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| OpenAI compat applicability | provider/model detection in schema compat layers and core agent structured-output path | structured output, agent networks, workspace tools |
| Base Standard Schema conversion | generic `toStandardSchema()` adapters, including Zod v4 wrapper from #14157 | provider-specific compatibility layers |
| Strict JSON schema shape | `prepareJsonSchemaForOpenAIStrictMode()` / `ensureAllPropertiesRequired()` + OpenAI compat post-processors | AI SDK response format/tool schema serialization |
| Null-to-undefined parsing | `wrapSchemaWithNullTransform()` and OpenAI schema transforms | structured output parsing for optional fields |
| Native strict flag | `packages/core/src/stream/aisdk/v5/execute.ts` provider options | OpenAI API calls |

## Key files

- `packages/core/src/agent/agent.ts` — applies null-transform compatibility when structured output targets OpenAI, including undefined/empty `modelId` provider-only cases.
- `packages/core/src/stream/aisdk/v5/execute.ts` — prepares strict schemas and sets `openai.strictJsonSchema`.
- `packages/schema-compat/src/zod-to-json.ts` — exports `ensureAllPropertiesRequired()` and `prepareJsonSchemaForOpenAIStrictMode()`.
- `packages/schema-compat/src/standard-schema/standard-schema.ts` and `adapters/zod-v4.ts` — generic Standard Schema JSON Schema conversion feeding provider-specific schema compat.
- `packages/schema-compat/src/provider-compats/openai.ts` — OpenAI schema compatibility, optional/default/null transforms, required-key and `additionalProperties` handling.
- `packages/schema-compat/src/provider-compats/openai-reasoning.ts` — reasoning-model variant with null-safe `modelId` checks.

## Dependencies / related features

- [Tool schema compatibility](./tool-schema-compatibility.md) — generic schema conversion layer that provider-specific strict handling builds on.
- [Model auth, selection, and modes](./model-auth-and-modes.md) — model/provider routing determines when OpenAI compatibility applies.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — workspace tool schemas are a key consumer of strict schema compatibility.
- [Headless prompt mode](../headless/prompt-mode.md) — headless uses the same model/tool schema paths.

## Existing tests

- `packages/core/src/agent/__tests__/structured-output-openai-compat.test.ts` — exercises real Agent structured-output path with valid, undefined, and empty `modelId` values, null-to-undefined parsing, and the exact OpenAI strict response schema shape handed to the model.
- `packages/schema-compat/src/zod-to-json.test.ts` — covers `ensureAllPropertiesRequired()` across root, nested, array, union, and non-object schemas.
- `mastracode/scripts/mc-e2e/scenarios/openai-strict-schema.ts` — real PTY TUI prompt with AIMock OpenAI request verification. The scenario launches an embedded Mastra Code TUI with an e2e-only `strict_schema_probe` tool containing optional top-level and nested Zod fields, then asserts the provider-visible OpenAI tool schema requires every property and has `additionalProperties: false` recursively.
- OpenAI workspace/structured-output e2e tests are present but require external credentials.

## Missing tests

- Live OpenAI workspace/structured-output coverage still depends on external credentials and remains outside deterministic local CI.

## E2E recovery evidence

- New scenario: `openai-strict-schema`.
- Contracts covered: real TUI prompt reaches the OpenAI-compatible provider path through AIMock; optional top-level tool fields become required in the final request; nested optional object fields become required recursively; top-level and nested object schemas retain `additionalProperties: false`.
- Break validation:
  1. Dropped prepared tool parameters in `packages/core/src/stream/aisdk/v5/compat/prepare-tools.ts`; after `pnpm build:core`, `openai-strict-schema` failed request verification because the schema no longer had required properties.
  2. Forced top-level prepared tool `additionalProperties: true`; after `pnpm build:core`, `openai-strict-schema` failed with `Expected strict_schema_probe additionalProperties false`.
  3. Forced nested prepared tool `additionalProperties: true`; after `pnpm build:core`, `openai-strict-schema` failed with `Expected nested additionalProperties false`.
- Final focused verification: `pnpm --filter ./mastracode run e2e:test openai-strict-schema`.

## Known risks / regressions

- Strict-mode schema rules are provider-specific and can drift as OpenAI changes requirements.
- Recursive required-key mutation can make schemas valid for OpenAI while changing semantics for optional fields if null transforms are skipped.
- Provider/model detection must remain null-safe because agent networks can construct models without a concrete `modelId`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
