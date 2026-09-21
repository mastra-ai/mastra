---
'mastra': patch
---

Studio only shows the Server-Sent Events endpoint for MCP 1.x servers; MCP v2 servers list Streamable HTTP alone. Running a tool that answers with `status: 'suspended'` (it needs native MCP input rounds) now shows a notice explaining that Studio cannot supply that input, with the suspend payload still visible, and other execution failures are surfaced in the result panel instead of leaving it empty.

Open Studio as before to see the updated MCP pages:

```bash
mastra dev
```
