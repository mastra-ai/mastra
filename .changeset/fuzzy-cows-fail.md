---
'@mastra/server': patch
---

Added workspace routing for spreadsheet attachments. Agent generate, stream, stream-until-idle, network, signal, send-message and queue-message requests that include `.xlsx` or `.xls` files no longer send them to the model, since most models cannot read them. The file is saved to the agent's workspace under `uploads/` (to the filesystem, or directly into the sandbox when the workspace has no filesystem, such as an E2B-only workspace), and the model receives a note with the file path so it can open it with workspace tools. If the agent has no workspace, the request fails with a 403 and a JSON body containing `code: 'WORKSPACE_REQUIRED_FOR_ATTACHMENT'`, which clients can use to show a helpful message.
