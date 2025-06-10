---
'@mastra/core': patch
---

Now that UIMessages are stored, we added a check to make sure large text files or source urls are not sent to the LLM for thread title generation.
