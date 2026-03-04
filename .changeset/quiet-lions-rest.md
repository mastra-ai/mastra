---
"@mastra/playground-ui": patch
---

Remove the Playground UI GPT-5 temperature auto-default workaround in agent settings. Temperature now remains unset unless explicitly provided by saved settings or code defaults, preventing refresh-time resets to `1`.
