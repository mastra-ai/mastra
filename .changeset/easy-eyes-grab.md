---
'@mastra/factory': patch
'@mastra/react': patch
---

Fixed the Mastra client being recreated on every render of MastraClientProvider, which silently reset per-client caches such as endpoint support and capability probes.
