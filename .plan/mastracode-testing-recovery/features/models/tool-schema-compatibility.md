# Tool schema compatibility

## Origin PR / commit

- PR: [#13253](https://github.com/mastra-ai/mastra/pull/13253) — earlier Zod/schema routing work for tool input schemas.
- Later changes: [#13695](https://github.com/mastra-ai/mastra/pull/13695) — OpenAI strict-mode schema shaping; [#14157](https://github.com/mastra-ai/mastra/pull/14157) — wraps Zod v4 schemas that lack `~standard.jsonSchema` so tool schemas serialize correctly for providers such as Anthropic; [#14264](https://github.com/mastra-ai/mastra/pull/14264) — avoided false `z.toJSONSchema is not available` errors across Zod module export shapes and tightened linting against `require()` imports.

## User-visible behavior

- What the user can do: use built-in Harness/Mastra Code tools defined with Zod v4 schemas without provider requests failing because the schema converted to a non-object / `None` shape.
- Success looks like: tools such as `ask_user`, `task_write`, `task_check`, and `submit_plan` produce valid JSON Schema objects for model tool-calling, even with Zod 3.25's v4 compatibility layer.
- Must preserve: validation behavior stays owned by the original Zod schema while JSON Schema export is added through the Standard Schema wrapper, and the adapter must keep working across Zod v4 / Zod 3.25 compat export layouts.

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
| Zod v4 JSON Schema converter | `standard-schema/adapters/zod-v4.ts` using `z.toJSONSchema()`; #14264 added export-shape fallback handling, with later follow-ups changing the loader again | Tool-calling providers |
| JSON Schema library options | `JSON_SCHEMA_LIBRARY_OPTIONS` | Date handling, `additionalProperties`, unrepresentable types |
| Mastra Code Zod dependency | `mastracode/package.json` dependency entry | CLI packaging stability |

## Key files

- `packages/schema-compat/src/standard-schema/standard-schema.ts` — detects Zod v4 schemas without `~standard.jsonSchema` and routes them to the Zod v4 adapter before falling back to Zod v3 / AI SDK / JSON Schema adapters.
- `packages/schema-compat/src/standard-schema/adapters/zod-v4.ts` — wraps Zod v4 schemas with a `~standard.jsonSchema` converter while preserving validation methods/prototype behavior; #14264 originally broadened `toJSONSchema` lookup across `zod/v4` and `zod` export shapes before later loader follow-ups changed the implementation again.
- `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` — covers Harness tool schema patterns, nested objects, enums, optional/nullable fields, validation preservation, and target mapping.
- `packages/_config/src/eslint.js` — #14264 added `@typescript-eslint/no-require-imports` to avoid reintroducing CommonJS require patterns in TS source.
- `mastracode/package.json` — ships `zod` as a CLI dependency so Mastra Code does not rely on a user-installed peer.

## Dependencies / related features

- [OpenAI strict schema compatibility](./openai-strict-schema-compat.md) — provider-specific strict-mode shaping builds on the generic schema conversion path.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tool definitions and permission surfaces depend on accurate schemas.
- [Headless prompt mode](../headless/prompt-mode.md) — headless runs expose the same tool schemas.

## Existing tests

- `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` — Zod v4 adapter coverage for Standard Schema + JSON Schema conversion, including routed provider serialization for built-in Mastra Code command tool schemas when native `~standard.jsonSchema` is absent.
- `packages/schema-compat/src/zod-to-json.test.ts` and provider compat tests — adjacent provider/schema compatibility coverage.
- `mastracode/scripts/mc-e2e/scenarios/tool-schema-compat.ts` + `mastracode/scripts/mc-e2e/fixtures/tool-schema-compat.json` — real PTY Mastra Code prompt through OpenAI AIMock that verifies provider-visible built-in command tool schemas include usable object/nested properties for `ask_user`, `task_write`, and `submit_plan`.
- PR #14264 test plan targeted `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` and eslint on the adapter; current source has later loader changes, so future follow-up rows should refresh this section.

## Missing tests

- Packaging test proving the published CLI can resolve its bundled `zod` dependency without relying on a project-level install.

## Known risks / regressions

- Zod v4 and Zod 3.25's v4 compatibility layer can differ in `toJSONSchema()` behavior; adapter options must stay aligned with provider requirements.
- Zod module export shapes changed repeatedly after #14264 (`zod/v4`, `zod`, CJS/ESM bundling); loader changes must be tested in both source checkout and packaged CLI/runtime contexts.
- The wrapper uses prototype preservation; future schema libraries with similar internals should not be incorrectly classified as Zod v4 just because they expose `_zod`.
- Provider strictness can still require additional post-processing beyond generic JSON Schema conversion.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
