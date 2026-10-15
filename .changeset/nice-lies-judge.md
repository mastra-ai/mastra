---
'mastra': patch
---

Factory settings now let you choose whether a Factory's sessions use the organization's models and credentials or each session owner's own. The setting is also available from the CLI:

```bash
mastra api factory project update <project-id> '{"modelScope":"user"}'
```
