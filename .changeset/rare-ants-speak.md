---
'@mastra/core': patch
---

Fixed aborting a thread run that had several messages sent to it: the follow-up run now answers all of them in one turn, instead of one message per run (which made you abort once per pending message). Messages added with `queueMessage` still run one at a time after it.
