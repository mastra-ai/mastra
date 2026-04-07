---
'@mastra/client-js': patch
---

Fixed Vector SDK return types to match actual server responses.

Three methods had incorrect TypeScript return types that caused runtime failures even though TypeScript compilation succeeded:

- `getIndexes()` now returns `Promise<string[]>` instead of `Promise<{ indexes: string[] }>`
- `upsert()` now returns `Promise<{ ids: string[] }>` instead of `Promise<string[]>`
- `query()` now returns `Promise<QueryResult[]>` instead of `Promise<QueryVectorResponse>`

The `QueryVectorResponse` interface is now deprecated — use `QueryResult[]` from `@mastra/core/vector` instead.
