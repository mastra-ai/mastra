---
'@mastra/core': minor
---

Improved how the workspace `read_file` tool returns files to the model. Reads now branch on file type:

1. **Media files** (default: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`) are surfaced as native file/image parts the model can directly view, instead of being dumped as base64 text. Capped at 10 MiB by default so large media don't get base64-encoded into context and persisted in storage — configurable via `maxMediaBytes`.
2. **Text-readable files** (anything `text/*`, common code/config mime types, or unknown extensions) are returned as text content as before.
3. **Unsupported binaries** (e.g. `image/png` when `mediaTypes` is disabled, `application/zip`, oversized media, etc.) now return a short metadata description (`path`, size, mime type) instead of dumping useless base64 into the conversation. Pass an explicit `encoding` to opt back into the raw base64/hex dump.

The set of mime types treated as native media parts and the inline size cap are configurable per workspace:

```ts
import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem,
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
      // Broaden to any image (e.g. SVG, BMP, HEIC) — may fail on some providers
      mediaTypes: ['image/*', 'application/pdf'],

      // Raise the inline-media cap to 25 MiB
      maxMediaBytes: 25 * 1024 * 1024,

      // Or a custom predicate
      // mediaTypes: (mime) => mime.startsWith('image/'),

      // Or disable media parts entirely
      // mediaTypes: false,
    },
  },
});
```

The default `mediaTypes` is intentionally the cross-provider-safe intersection — formats universally supported across Anthropic, OpenAI, and Gemini.
