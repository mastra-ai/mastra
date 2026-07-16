---
'@mastra/client-js': patch
'@mastra/server': patch
---

Replace `any` with `unknown` in generated route types so clients get real type errors instead of silently unchecked values. Route-types generation now deduplicates shared schemas into reusable type aliases, shrinking the generated `route-types.generated.ts` from ~94K to ~22K lines (77% smaller). The memory config response now types `workingMemory` (enabled, scope, template, schema, version) instead of `unknown`.
