---
'@mastra/core': patch
---

Fixed images and files returned by tools going missing when an agent uses a router model such as `anthropic/*`. The selected model now receives the complete tool result, including images and files.
