---
'@mastra/core': patch
---

Fixed concurrent durable agent runs saving each other's conversation. When runs of the same durable agent (or parent workflows sharing a nested workflow) started at the same time, a nested run's first saved snapshot could hold another run's input and state. Listing runs for one resource could return another run's conversation while it was in progress, and recovering a run that crashed before its first step continued as the other run: it sent that conversation to the model and saved the reply to the other run's thread. Each nested run now saves its own input and state.
