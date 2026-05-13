---
'@mastra/core': minor
---

Improved how the workspace `read_file` tool returns files to the model. Reads now branch on file type:

1. **Media files** (default: `image/*`, `application/pdf`) are surfaced as native file/image parts the model can directly view, instead of being dumped as base64 text.
2. **Text-readable files** (anything `text/*`, common code/config mime types, or unknown extensions) are returned as text content as before.
3. **Unsupported binaries** (e.g. `image/png` when `mediaTypes` is disabled, `application/zip`, etc.) now return a short metadata description (`path`, size, mime type) instead of dumping useless base64 into the conversation. Pass an explicit `encoding` to opt back into the raw base64/hex dump.

The set of mime types treated as native media parts is configurable per workspace via a new `mediaTypes` option on the read_file tool config:

```ts
import { Workspace, WORKSPACE_TOOLS } from '@mastra/core/workspace';

const workspace = new Workspace({
  filesystem,
  tools: {
    [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]: {
      // Glob patterns
      mediaTypes: ['image/*', 'application/pdf'],

      // Or a custom predicate
      // mediaTypes: (mime) => mime.startsWith('image/'),

      // Or disable entirely
      // mediaTypes: false,
    },
  },
});
```

Defaults to `['image/*', 'application/pdf']` — the formats universally supported as native media parts across Anthropic, OpenAI, and Gemini.
