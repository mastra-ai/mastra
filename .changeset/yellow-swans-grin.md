---
'@mastra/core': patch
---

Agent run stream events now send only the response messages that changed since the previous step, instead of every response message of the run so far on every step. A long run with large tool outputs no longer stores each output once per later step. `agent.observe()` still reports the full list for each step, including when it starts from an offset. During a rolling upgrade, an observer still on an older version reports no response messages for steps published by the new version.
