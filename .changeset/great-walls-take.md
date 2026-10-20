---
'mastra': patch
---

Factory settings now show the thinking level under Factory defaults, editable by organization admins, and chats label the fallback as the Factory default. The deployment-wide "Thinking defaults" and per-chat "Chat defaults" rows are gone. `mastra api` accepts `defaultThinkingLevel` when updating a Factory project:

```bash
mastra api factory project update "$FACTORY_ID" '{"defaultThinkingLevel":"high"}'
```
