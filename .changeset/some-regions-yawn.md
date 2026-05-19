---
'@mastra/core': patch
---

Fixed Azure OpenAI content moderation false-positives caused by `<system-reminder>` tags in Observational Memory and temporal gap markers. When using Azure OpenAI, these tags are now renamed to `<memory-context>` on the outbound request only — persisted history and other providers are unaffected.
