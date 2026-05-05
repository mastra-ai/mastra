---
'@mastra/langsmith': minor
---

Added support for forwarding Mastra eval scores to LangSmith. When a scorer runs against an agent or workflow, its score is automatically attached to the corresponding LangSmith run as feedback, so eval results appear alongside their traces in the LangSmith UI for easier tracking and review.
