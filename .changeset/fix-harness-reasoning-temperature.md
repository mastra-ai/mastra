---
"@mastra/core": patch
---

Fix [400] Unsupported parameter: temperature error when using reasoning models (o1, o3, o4-mini, gpt-5, sonar-reasoning, grok-4-reasoning). The harness now omits temperature and top_p for reasoning models instead of sending unsupported sampling parameters.
