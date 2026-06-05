# OpenAI strict schema compatibility

## Origin PR / commit

- PR: [#13695](https://github.com/mastra-ai/mastra/pull/13695) — fixed OpenAI strict-mode schema rejection for agent networks and workspace/tool schemas.
- Later changes: none mapped yet.

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
| Strict JSON schema shape | `prepareJsonSchemaForOpenAIStrictMode()` / `ensureAllPropertiesRequired()` + OpenAI compat post-processors | AI SDK response format/tool schema serialization |
| Null-to-undefined parsing | `wrapSchemaWithNullTransform()` and OpenAI schema transforms | structured output parsing for optional fields |
| Native strict flag | `packages/core/src/stream/aisdk/v5/execute.ts` provider options | OpenAI API calls |

## Key files

- `packages/core/src/agent/agent.ts` — applies null-transform compatibility when structured output targets OpenAI, including undefined/empty `modelId` provider-only cases.
- `packages/core/src/stream/aisdk/v5/execute.ts` — prepares strict schemas and sets `openai.strictJsonSchema`.
- `packages/schema-compat/src/zod-to-json.ts` — exports `ensureAllPropertiesRequired()` and `prepareJsonSchemaForOpenAIStrictMode()`.
- `packages/schema-compat/src/provider-compats/openai.ts` — OpenAI schema compatibility, optional/default/null transforms, required-key and `additionalProperties` handling.
- `packages/schema-compat/src/provider-compats/openai-reasoning.ts` — reasoning-model variant with null-safe `modelId` checks.

## Dependencies / related features

- [Model auth, selection, and modes](./model-auth-and-modes.md) — model/provider routing determines when OpenAI compatibility applies.
- [Workspace-backed coding tools](../tools/workspace-tools.md) — workspace tool schemas are a key consumer of strict schema compatibility.
- [Headless prompt mode](../headless/prompt-mode.md) — headless uses the same model/tool schema paths.

## Existing tests

- `packages/core/src/agent/__tests__/structured-output-openai-compat.test.ts` — exercises real Agent structured-output path with valid, undefined, and empty `modelId` values.
- `packages/schema-compat/src/zod-to-json.test.ts` — covers `ensureAllPropertiesRequired()` across root, nested, array, union, and non-object schemas.
- OpenAI workspace/structured-output e2e tests are present but require external credentials.

## Missing tests

- Narrow Mastra Code headless/TUI regression that uses an OpenAI model plus workspace tool schemas through the MC runtime.
- Local no-network test for OpenAI Responses + workspace tools that asserts the exact final tool schema sent to the provider.

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
