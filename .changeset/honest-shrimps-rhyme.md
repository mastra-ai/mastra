---
'@mastra/core': minor
'@mastra/mcp-docs-server': patch
'@mastra/client-js': patch
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/connect': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added file-based avatar storage so agents can generate and persist their own avatars instead of being limited to base64 `data:` URLs inlined into agent metadata.

**What's new**

- New `AvatarStore` interface with two built-in implementations:
  - `WorkspaceAvatarStore` — writes to `.mastra/avatars/<agentId>.<ext>` via any attached `WorkspaceFilesystem` (local, Mastra, or custom).
  - `LocalAvatarStore` — writes to a local directory (defaults to `os.tmpdir()/mastra-avatars`).
- `Mastra` auto-selects a store: user-provided `avatarStore` > `WorkspaceAvatarStore` when a workspace filesystem is attached > `LocalAvatarStore` fallback. Retrieve it with `mastra.getAvatarStore()`.
- New `agent.setAvatar(bytes, mime)` method persists the image, updates `metadata.avatarUrl` to a `mastra-avatar:<agentId>` reference, and fans out to channel adapters. Discord bot avatars sync automatically via the discord.js `client.user.setAvatar` / REST `/users/@me` shape; adapters for other platforms can opt in by implementing the new `AvatarSyncCapableAdapter` interface. Platforms without a public bot-avatar API (Slack, Telegram, Teams, Google Chat) are skipped with a documented reason.
- New `createSetOwnAvatarTool({ generateImage })` factory returns a built-in tool that lets an agent regenerate its own avatar from a **short natural-language prompt** — the tool calls the injected image generator and passes the resulting bytes straight to `agent.setAvatar`. The LLM never emits or receives base64 (a 500 KB avatar would otherwise cost ~180K output tokens).

**Usage**

```ts
import { Mastra, LocalAvatarStore } from '@mastra/core';
import { createSetOwnAvatarTool } from '@mastra/core/tools';
import { experimental_generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';

const mastra = new Mastra({
  // avatarStore is optional — auto-selected from workspace/filesystem otherwise
  avatarStore: new LocalAvatarStore({ basePath: './avatars' }),
  agents: { myAgent },
});

// Programmatic:
const { url, syncedChannels } = await myAgent.setAvatar(pngBytes, 'image/png');

// Or expose the tool so the agent can regenerate its own avatar from a prompt:
new Agent({
  tools: {
    setOwnAvatar: createSetOwnAvatarTool({
      generateImage: async (prompt) => {
        const { image } = await experimental_generateImage({
          model: openai.image('dall-e-3'),
          prompt,
          size: '512x512',
        });
        return { bytes: Buffer.from(image.uint8Array), mime: image.mimeType };
      },
    }),
  },
});
```

Existing `data:` URL avatars continue to work unchanged. Custom stores may return absolute `https://` URLs (e.g. S3/CDN) directly.
