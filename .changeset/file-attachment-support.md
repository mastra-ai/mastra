---
'@mastra/core': patch
'mastracode': patch
---

**`sendMessage` now accepts `files` instead of `images`**, supporting any file type with optional `filename`.

**Breaking change:** Rename `images` to `files` when calling `harness.sendMessage()`:

```ts
// Before
await harness.sendMessage({
  content: "Analyze this",
  images: [{ data: base64Data, mimeType: "image/png" }],
});

// After
await harness.sendMessage({
  content: "Analyze this",
  files: [{ data: base64Data, mediaType: "image/png", filename: "screenshot.png" }],
});
```

- `files` accepts `{ data, mediaType, filename? }` — filenames are now preserved through storage and message history
- Text-based files (`text/*`, `application/json`) are automatically decoded to readable text content instead of being sent as binary, which models could not process
- `HarnessMessageContent` now includes a `file` type, so file parts round-trip correctly through message history
