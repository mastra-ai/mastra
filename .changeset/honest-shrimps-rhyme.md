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
- New `agent.setAvatar(bytes, mime)` method persists the image, updates `metadata.avatarUrl` to a `mastra-avatar:<agentId>` reference, and fans out to any channel adapter implementing the optional `AvatarSyncCapableAdapter` interface (`setAvatar(bytes, mime)`).
- New `setOwnAvatarTool` built-in tool lets an agent write its own avatar mid-run from base64 bytes produced by an image-generation tool.

**Usage**

```ts
import { Mastra, LocalAvatarStore } from '@mastra/core';
import { setOwnAvatarTool } from '@mastra/core/tools';

const mastra = new Mastra({
  // avatarStore is optional — auto-selected from workspace/filesystem otherwise
  avatarStore: new LocalAvatarStore({ basePath: './avatars' }),
  agents: { myAgent },
});

// Programmatic:
const { url, syncedChannels } = await myAgent.setAvatar(pngBytes, 'image/png');

// Or expose the tool so the agent can update its own avatar:
new Agent({ tools: { setOwnAvatar: setOwnAvatarTool } });
```

Existing `data:` URL avatars continue to work unchanged. Custom stores may return absolute `https://` URLs (e.g. S3/CDN) directly.
