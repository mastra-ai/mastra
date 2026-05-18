---
'@mastra/server': patch
---

Fix Zod regression where bare-string memory query params (e.g.
`?orderBy=updatedAt&sortDirection=DESC`) returned a 400 with
`expected object, received undefined`.

The previous fix in #15969 changed the optional memory query schemas from
`z.preprocess(fn, inner.optional())` to `z.preprocess(fn, inner).optional()`
to handle omitted keys under Zod 4.4.0+. That worked for missing params
but broke clients that still passed non-JSON values: the JSON.parse
preprocess collapses such values to `undefined`, the outer `.optional()`
no longer triggers (the original input was a defined string), and the
inner object/array/record schema then receives `undefined` and fails
validation.

Restored the previous behavior by keeping optionality both inside and
outside the preprocess (`z.preprocess(fn, inner.optional()).optional()`)
across `storageOrderBySchema`, `messageOrderBySchema`, `includeSchema`,
`filterSchema`, `memoryConfigSchema`, the inline `metadata` and
`includeSystemReminders` schemas in `listThreadsQuerySchema` /
`listThreadsNetworkQuerySchema` / `listMessagesQuerySchema`. Bare-string
values now silently resolve to `undefined`, matching pre-1.31.0
behavior, while valid JSON values continue to parse and malformed JSON
in `metadata`/`include`/`filter` continues to surface a clear validation
error.

Added regression tests covering the bare-string `orderBy=updatedAt`
case on `listThreadsQuerySchema` and `listMessagesQuerySchema`.
