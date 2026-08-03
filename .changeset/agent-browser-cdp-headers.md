---
'@mastra/agent-browser': minor
---

Add optional `cdpHeaders` on AgentBrowser for authenticated CDP connections (e.g. Cloudflare Browser Rendering Authorization). Headers are forwarded to agent-browser `launch({ cdpHeaders })` → `connectOverCDP`. Requires an agent-browser build that honors `cdpHeaders` on the generic CDP path.
