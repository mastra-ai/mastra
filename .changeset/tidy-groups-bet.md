---
'@mastra/memory': patch
---

Fixed Observational Memory missing the observation threshold for messages with large file parts. Previously `TokenCounter` only counted the file descriptor (`type`, `mimeType`, `filename`) for non-image files, so a 100KB PDF looked like ~8 tokens to OM and the conversation kept replaying the full unobserved history past every reasonable threshold.

`TokenCounter` now auto-estimates non-image file part tokens from the attachment's byte size and mime type using a per-provider heuristic, mirroring the existing image-token estimator:

- Anthropic PDFs ≈ `bytes / 3` (floor 1500)
- Google PDFs ≈ `bytes / 20` (floor 258)
- OpenAI / unknown PDFs ≈ `bytes / 4` (floor 500)
- Text-ish mime types (`text/*`, JSON, XML, YAML) ≈ `bytes / 4`
- Other binary ≈ `bytes / 4`

URL-only file parts (no body to size) fall back to the previous descriptor-only estimate.

```ts
// Before: this PDF counted as ~8 tokens regardless of size, so OM never triggered.
const part = {
  type: 'file',
  data: largePdfBase64,
  mimeType: 'application/pdf',
  filename: 'report.pdf',
};
// counter.countMessage(message) ≈ 8

// After: auto-estimated from byte size on the active provider.
// counter.countMessage(message) ≈ tens of thousands of tokens
//   → OM threshold trips as expected.
```

The internal token-estimate cache version was bumped, which invalidates persisted estimates from older `@mastra/memory` releases on the next read; entries are recomputed automatically.

Fixes https://github.com/mastra-ai/mastra/issues/16522
