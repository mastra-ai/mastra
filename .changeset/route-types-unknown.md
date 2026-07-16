---
'@mastra/client-js': patch
'@mastra/server': patch
---

Replace `any` with `unknown` in generated route types so clients get real type errors instead of silently unchecked values. Route-types generation now shares a global auxiliary type store, deduplicating the generated file. The memory config response now types `workingMemory` (enabled, scope, template, schema, version) instead of `unknown`.
