---
'@mastra/factory': patch
'@mastra/core': patch
---

Fixed workspace skill discovery silently reporting zero skills when the workspace filesystem is mis-wired. Programming errors (such as a TypeError) from the skill source now surface from refresh() instead of being logged as an inaccessible skills path warning. Closes https://github.com/mastra-ai/mastra/issues/22639
