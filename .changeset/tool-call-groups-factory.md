---
'@mastra/factory': patch
---

Improved the chat transcript: a run of three or more tool calls now folds into a single row while the reply is still being written, instead of only once it is finished. The folded row names the step that is running and counts progress, and opens onto the individual calls. Calls that need something from you, such as a question, a plan or an approval, stay on their own row.
