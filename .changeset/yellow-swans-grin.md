---
'@mastra/redis-streams': patch
'@mastra/core': patch
---

Agent run stream events now send only the response messages that changed since the previous step, instead of every response message of the run so far on every step. A long run with large tool outputs no longer stores each output once per later step. Readers (`agent.observe()`, reconnecting clients) still report the full list per step, including when they start from an offset.
