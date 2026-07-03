---
'@mastra/core': patch
'@mastra/deployer': patch
'@mastra/auth-okta': patch
'@mastra/playground-ui': patch
---

Hardened several string-parsing code paths against regular-expression denial of service (ReDoS). Path normalization, URL trimming, LLM token stripping, and observation parsing now use linear-time string scanning instead of regexes that could back-track polynomially on adversarial input. No behavior changes.
