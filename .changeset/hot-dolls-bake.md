---
'@mastra/factory': patch
---

Fixed session resume silently provisioning a replacement VM instead of reattaching to the original sandbox. Factory now persists the provider's physical sandbox id and forwards it back on resume, so providers that reattach by id (like Railway) reconnect to the same VM instead of orphaning it and doubling compute cost. Closes #23974.
