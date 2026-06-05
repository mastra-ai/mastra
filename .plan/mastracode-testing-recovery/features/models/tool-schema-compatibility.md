# Tool schema compatibility

## Origin PR / commit

- PR: [#13253](https://github.com/mastra-ai/mastra/pull/13253) — earlier Zod/schema routing work for tool input schemas.
- Later changes: [#13695](https://github.com/mastra-ai/mastra/pull/13695) — OpenAI strict-mode schema shaping; [#14157](https://github.com/mastra-ai/mastra/pull/14157) — wraps Zod v4 schemas that lack `~standard.jsonSchema` so tool schemas serialize correctly for providers such as Anthropic.

## User-visible behavior

- What the user can do: use built-in Harness/Mastra Code tools defined with Zod v4 schemas without provider requests failing because the schema converted to a non-object / `None` shape.
- Success looks like: tools such as `ask_user`, `task_write`, `task_check`, and `submit_plan` produce valid JSON Schema objects for model tool-calling, even with Zod 3.25's v4 compatibility layer.
- Must preserve: validation behavior stays owned by the original Zod schema while JSON Schema export is added through the Standard Schema wrapper.

## Entry points / commands

- Commands / shortcuts / flags: automatic through all agent runs that expose tool schemas to model providers.
- Automatic triggers: `toStandardSchema()` receives tool input schemas from Harness/core tool registration and routes Zod v4 schemas through the adapter when `~standard.jsonSchema` is missing.

## TUI states

- Idle: no direct UI.
- Active / modal / error: schema failures previously appeared as provider API errors during active model runs; the compatibility layer prevents those malformed-schema requests.

## Headless / non-TUI behavior

- Supported: headless `--prompt` uses the same tool schema serialization path.
- Not supported / unknown: provider-specific live behavior depends on external credentials; narrow local tests exercise conversion, not remote provider calls.

## Streaming / loading / interrupted states

- Streaming / loading: schemas are converted before a model request begins.
- Abort / retry / resume: no extra state; failed provider requests surface through normal error display.

## Streaming vs loaded-from-history behavior

- While actively streaming: valid tool schemas are part of the outbound provider request.
- After reload / history reconstruction: historical tool calls are unaffected; future runs use the current schema compatibility path.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Original tool schema | Tool definitions / Zod schema instance | Validation and type inference |
| Standard Schema wrapper | `toStandardSchema()` | Provider tool schema serialization |
| Zod v4 JSON Schema converter | `standard-schema/adapters/zod-v4.ts` using `z.toJSONSchema()` | Tool-calling providers |
| JSON Schema library options | `JSON_SCHEMA_LIBRARY_OPTIONS` | Date handling, `additionalProperties`, unrepresentable types |
| Mastra Code Zod dependency | `mastracode/package.json` | CLI packaging stability |

## Key files

- `packages/schema-compat/src/standard-schema/standard-schema.ts` — detects Zod v4 schemas without `~standard.jsonSchema` and routes them to the Zod v4 adapter before falling back to Zod v3 / AI SDK / JSON Schema adapters.
- `packages/schema-compat/src/standard-schema/adapters/zod-v4.ts` — wraps Zod v4 schemas with a `~standard.jsonSchema` converter while preserving validation methods/prototype behavior.
- `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` — covers Harness tool schema patterns, nested objects, enums, optional/nullable fields, validation preservation, and target mapping.
- `mastracode/package.json` — ships `zod` as a CLI dependency so Mastra Code does not rely on a user-installed peer.

## Dependencies / related features

- [OpenAI strict schema compatibility](./openai-strict-schema-compat.md) — provider-specific strict-mode shaping builds on the generic schema conversion path.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tool definitions and permission surfaces depend on accurate schemas.
- [Headless prompt mode](../headless/prompt-mode.md) — headless runs expose the same tool schemas.

## Existing tests

- `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` — Zod v4 adapter coverage for Standard Schema + JSON Schema conversion.
- `packages/schema-compat/src/zod-to-json.test.ts` and provider compat tests — adjacent provider/schema compatibility coverage.

## Missing tests

- End-to-end Mastra Code tool-call smoke test with a provider mock that asserts serialized tool schemas for `ask_user`, `task_write`, `task_check`, and `submit_plan` are JSON Schema objects.
- Packaging test proving the published CLI can resolve its bundled `zod` dependency without relying on a project-level install.

## Known risks / regressions

- Zod v4 and Zod 3.25's v4 compatibility layer can differ in `toJSONSchema()` behavior; adapter options must stay aligned with provider requirements.
- The wrapper uses prototype preservation; future schema libraries with similar internals should not be incorrectly classified as Zod v4 just because they expose `_zod`.
- Provider strictness can still require additional post-processing beyond generic JSON Schema conversion.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
