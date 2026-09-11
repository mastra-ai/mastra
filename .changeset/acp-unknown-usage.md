---
'@mastra/code-sdk': patch
---

Stopped ACP and headless responses from reporting incomplete token usage as a complete measurement. ACP omits its optional usage report when required counts are unknown, and `runMC()` preserves unknown counts across multi-step runs.
