---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'mastra': patch
---

Export CODE_AGENT_ID from @mastra/code-sdk/constants so integrations can reference the same backing coding agent as the controller.
