---
'mastracode': minor
---

Added gateway support for routing LLM calls through a configurable base URL with custom headers. Use the new `/gateway` slash command to set a base URL and headers — all model requests will be routed through it. When a gateway is active, Observational Memory is automatically disabled since the gateway handles memory. Custom providers now also support per-provider headers.
