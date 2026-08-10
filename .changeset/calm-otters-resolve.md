---
'@mastra/factory': patch
---

Fixed Slack threads on cloud factory deployments falling back to chat-only sessions or erroring instead of getting a repo-backed workspace.

Three fixes:

- Repository resolution now tries every source-control connection on a factory project and skips connections that no longer resolve. Previously it took the first connection and failed outright when that row was stale (for example after a GitHub App reinstall deleted the old installation but left its connection behind), which silently dropped every Slack thread to a chat-only session even though a healthy connection existed.
- Chat-only sessions on deployments configured with a remote sandbox now run without a workspace instead of replying with "A Factory session ID is required to create a remote sandbox workspace" on every message. The server host never executes commands for these sessions; workspace tools are simply not registered.
- Top-level DM and channel conversations (threads with no thread timestamp) now derive their session branch from the channel id instead of producing the invalid git ref `slack/`, which made every top-level DM session fail its clone.
