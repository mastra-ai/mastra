---
'@mastra/core': patch
---

Fix ListTracesResponse and other storage types resolving to `any`

Consumer-facing storage types (`ListTracesResponse`, `SpanRecord`, `ListTracesArgs`, etc.) were defined as `z.infer<typeof schema>` / `z.input<typeof schema>`. This caused TypeScript to resolve them to `any` when the consumer's zod version differed from the one used to build the declarations.

Replaced all 19 zod-inferred type aliases in `storage/domains/observability/types.ts` and 2 in `storage/domains/shared.ts` with explicit interface definitions. The zod schemas remain unchanged for runtime validation.

