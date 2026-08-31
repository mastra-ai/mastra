---
'@mastra/core': minor
'@mastra/editor': patch
---

Raised the maximum skill `description` length from 1024 to 2048 characters.

A skill whose description ran over the limit was rejected outright and dropped from the agent's catalogue, so a single long sentence cost the entire skill. Descriptions carry the trigger phrases a model routes on, and published skills do exceed 1024 characters in practice — Circle's `pay-via-agent-wallet` is 1128 — so the limit was losing working skills over a formatting detail.

The Agent Skills specification still recommends 1024 characters; Mastra now accepts up to 2048.
