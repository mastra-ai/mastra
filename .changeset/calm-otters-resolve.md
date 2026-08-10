---
'@mastra/factory': patch
---

Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace.

- Fixed repository resolution failing when a factory project carries a stale source-control connection (for example after a GitHub App reinstall deleted the old installation but left its connection behind). Resolution now tries every connection and skips the ones that no longer resolve.
- Fixed chat-only sessions on deployments configured with a remote sandbox replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. These sessions now run without a workspace, so workspace tools are simply not registered and the server host never executes commands for them.
- Fixed top-level DM and channel conversations (threads with no thread timestamp) failing their clone with the invalid git ref `slack/`. Their session branch now derives from the channel id.
