---
'@mastra/core': patch
---

Channel agents with a workspace can now open binary file attachments (ZIP, DOCX, PDF and so on) that need an authenticated download, such as Slack files. The file is downloaded through the adapter, saved under `channel-attachments/` in the agent's workspace, and the agent is told the workspace path instead of a private URL it can't open. Files over 10 MB, failed downloads, read-only workspaces and agents without a workspace keep the previous URL description.
