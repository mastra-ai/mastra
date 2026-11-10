---
'@mastra/core': patch
---

Fixed agent run streams growing with every step. A registered Agent publishes each run on its stream topic so it can be observed and resumed, and every step used to repeat the whole prompt and the full record of every earlier step there. Long runs could take hundreds of MB to GBs in Redis per run. Each event now carries only what readers need: the provider request stays with the caller, earlier steps are not repeated, and a delegated agent's streamed steps are reduced the same way. Observers of a plain Agent run (`agent.observe()`) now also get each step's content, and their `onFinish` reports the run's text and tool calls.
