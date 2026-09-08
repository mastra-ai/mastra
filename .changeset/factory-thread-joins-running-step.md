---
'@mastra/factory': patch
---

Show the current message and running tool when opening a thread during an automatically started run. Factory initializes the transcript from the controller display snapshot and refreshes history after connecting, so a checkout already in progress appears immediately and a run that finished while the page loaded does not leave the thread stuck thinking.
