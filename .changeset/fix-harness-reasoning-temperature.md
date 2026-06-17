---
"@mastra/core": patch
---

Fix [400] Unsupported parameter: temperature error when using reasoning models (o1, o3, o4-mini, gpt-5, sonar-reasoning, grok-4-reasoning). The harness now omits temperature for reasoning models instead of sending an unsupported sampling parameter.
