---
'@mastra/server': patch
---

Fixed Studio showing a provider as not connected when a registered gateway authenticates it through OAuth or stored credentials, for example the Mastra Code gateway with a ChatGPT subscription login. The providers list and the instructions enhancer now run the same gateway auth chain the model router uses at run time, after the environment variable check, so a working subscription route no longer shows a "Set OPENAI_API_KEY to use this provider" warning. Fixes #23668
