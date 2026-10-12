---
'@mastra/langfuse': patch
---

Added top-level observation metadata in Langfuse for every span attribute (for example `stepIndex` and `isContinued` on model step spans). Observation-level LLM-as-a-Judge rules can now filter on them, for example to judge only the final step of an agent run. Fixes https://github.com/mastra-ai/mastra/issues/26635
