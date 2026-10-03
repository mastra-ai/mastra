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

Added out-of-band avatar storage so agents can generate and persist their own avatars instead of being limited to base64 `data:` URLs inlined into agent metadata.

**What's new**

- New `agentAvatars` storage domain (`mastra_agent_avatars` table) that stores one avatar per agent alongside the rest of your Mastra data. In-memory implementation ships in core; `@mastra/libsql` and `@mastra/pg` ship persistent implementations.
- New `AvatarStore` interface with three built-in implementations:
  - `StorageAvatarStore` — **the default.** Persists avatars through the configured storage adapter's `agentAvatars` domain, so avatars are exactly as durable and replicated as your storage, and zero-config deployments get correct behavior from the storage they already configure.
  - `WorkspaceAvatarStore` — opt-in; writes to `.mastra/avatars/<agentId>.<ext>` via an attached `WorkspaceFilesystem`.
  - `LocalAvatarStore` — opt-in; writes to a local directory (defaults to `os.tmpdir()/mastra-avatars`). Intended for tests/scratch use — not durable across hosts.
- `Mastra` resolves the store as: user-provided `avatarStore` > `StorageAvatarStore` backed by the configured storage. Retrieve it with `mastra.getAvatarStore()`.
- New `agent.setAvatar(bytes, mime)` method persists the image, updates `metadata.avatarUrl` to a `mastra-avatar:<agentId>` reference, and fans out to channel adapters. Discord bot avatars sync automatically via the discord.js `client.user.setAvatar` / REST `/users/@me` shape; adapters for other platforms can opt in by implementing the new `AvatarSyncCapableAdapter` interface. Platforms without a public bot-avatar API (Slack, Telegram, Teams, Google Chat) are skipped with a documented reason.
- New `createSetOwnAvatarTool({ generateImage })` factory returns a built-in tool that lets an agent regenerate its own avatar from a **short natural-language prompt** — the tool calls the injected image generator and passes the resulting bytes straight to `agent.setAvatar`. The LLM never emits or receives base64 (a 500 KB avatar would otherwise cost ~180K output tokens).
- Deleting a stored agent cascade-deletes its stored avatar.

**Usage**

```ts
import { Mastra } from '@mastra/core';
import { createSetOwnAvatarTool } from '@mastra/core/tools';
import { experimental_generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';

const mastra = new Mastra({
  storage, // avatars persist here by default — no extra config needed
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

Custom stores (e.g. S3/CDN) implement the `AvatarStore` interface and may return absolute `https://` URLs directly:

```ts
const mastra = new Mastra({
  avatarStore: new MyS3AvatarStore({ bucket: 'avatars' }),
  agents: { myAgent },
});
```

Existing `data:` URL avatars continue to work unchanged.
