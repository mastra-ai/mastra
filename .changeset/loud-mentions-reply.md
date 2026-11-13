---
'@mastra/core': patch
---

Channel agents now always reply when someone tags them in a public channel or thread. Messages that mention the bot are marked `mentioned="true"`, and the channel prompt tells the model to answer those, even with a short acknowledgement when the sender only says more details are coming. The stay-silent guidance now applies only to messages that don't mention the bot.
