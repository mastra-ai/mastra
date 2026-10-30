---
'@mastra/core': patch
---

Channel agents with a workspace can now open binary file attachments (ZIP, DOCX, PDF and so on) that need an authenticated download, such as Slack files. The file is downloaded through the adapter, saved under `channel-attachments/` in the agent's workspace, and the agent is told the workspace path instead of a private URL it can't open. This also applies to adapters whose links don't need a token, such as Discord: a Discord agent with a writable workspace now gets the workspace path instead of the CDN URL, which expires. Files over 10 MiB, failed downloads, read-only workspaces and agents without a workspace keep the previous URL description.

`channel-attachments/` is capped at 100 MiB per workspace so channel participants can't fill the disk. Once a file would go over the cap, the agent gets the URL instead and nothing is written. Change the cap with `maxAttachmentStorageBytes`:

```ts
new Agent({
  // ...
  channels: { adapters: { slack }, maxAttachmentStorageBytes: 500 * 1024 * 1024 },
});
```
