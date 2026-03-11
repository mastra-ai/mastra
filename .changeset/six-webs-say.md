---
'@mastra/core': patch
---

**Fixed**

- Prevented provider-executed tools from triggering extra loop iterations and duplicate requests.
- Preserved tool-call metadata during streaming so multi-turn conversations continue to work correctly with provider-executed tools.