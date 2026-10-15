---
'@mastra/core': minor
---

Added one preview format for span input, output and error. Trace lists (`queryTraces()`, `listTracesLight()`) now return `outputPreview` and `errorPreview` next to `inputPreview`, and `querySpans()` rows add `errorPreview` and `errorTruncated`.

**New exports from `@mastra/core/storage`**

- `buildPreview(value)` builds a preview from a decoded payload, and `buildPreviewFromJson(json)` from stored JSON text. Both cut to `PREVIEW_MAX_LENGTH` (100) characters and end with `…` when cut.
- Exported spans and span records accept optional `inputPreview`, `outputPreview` and `errorPreview`, preserved through create/update record builders. Stores trim nonblank supplied previews and cap them like generated ones (100 characters plus `…`, never splitting a surrogate pair); missing or blank previews are generated from the payload.

```ts
import { buildPreview } from '@mastra/core/storage';

buildPreview({ messages: [{ role: 'user', content: 'Where is my order?' }] }); // 'Where is my order?'
buildPreview({ message: 'Tool failed' }); // 'Tool failed'
```

**Behavior changes**

- For a message list, previews now show the last user message instead of every user message joined with `|`.
- `querySpans()` previews are now at most 100 characters of readable text plus an ellipsis instead of the first 256 characters of raw JSON.

`buildInputPreview()` and `INPUT_PREVIEW_MAX_LENGTH` are deprecated. Use `buildPreview()` and `PREVIEW_MAX_LENGTH`. `buildInputPreview(input, maxLength)` still caps its preview at `maxLength`.
