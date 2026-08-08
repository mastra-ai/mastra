---
'mastra': patch
---

Added a `mastra lint` check that detects when more than one copy of `@mastra/core` is installed.

Duplicate copies are the most common cause of confusing type errors like `Type 'Memory' is missing the following properties from type 'MastraMemory': #private, #private` or `Property '#private' in type 'PostgresStore' refers to a different member`. Mastra classes carry private fields, so a class built against one copy of `@mastra/core` is not assignable to the matching type from another copy. The code still runs fine, only `tsc --noEmit` fails, which makes the problem hard to place.

`mastra lint` now reports each copy it finds along with its version and how to collapse them:

```
[DUPLICATE_MASTRA_CORE] Found 2 separate copies of @mastra/core (1.51.0, 1.50.0):
  node_modules/@mastra/core (1.51.0),
  node_modules/@mastra/memory/node_modules/@mastra/core (1.50.0)
```

Symlinked copies that resolve to the same package on disk, which pnpm and npm workspaces create routinely, are not reported.
