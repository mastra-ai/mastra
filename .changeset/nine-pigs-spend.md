---
'@mastra/core': minor
---

Added support for sub-agent version overrides in core execution. Global defaults can be set on the Mastra instance and overridden per `generate()`/`stream()` call, with cascading propagation via requestContext.
