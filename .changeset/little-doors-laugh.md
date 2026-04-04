---
"@mastra/ai-sdk": patch
---

Fixed an issue where nested agent sub-tool streams dropped the 'uiMessages' and 'messages' properties during chunk propagation. The response payloads are now merged into the buffered pipeline execution correctly.
