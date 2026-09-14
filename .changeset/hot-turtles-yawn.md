---
'@mastra/server': patch
---

Fixed Studio showing a provider as not connected when a registered gateway authenticates it through OAuth or stored credentials, for example the Mastra Code gateway with a ChatGPT subscription login. With a core version that exports `GatewayManager`, the providers list and instructions enhancer consult the gateway auth chain after the environment variable check. Older supported core versions retain environment-variable checks instead of failing to load the server. Fixes #23668
