---
'@mastra/core': patch
---

Fixed agent run streams growing with every step. A registered Agent publishes each run on its stream topic so it can be observed and resumed, and every step used to repeat the whole prompt and all earlier steps there. Long runs could take hundreds of MB to GBs in Redis per run. Each event now carries only what readers need: the provider request stays with the caller, and earlier steps are no longer repeated. Delegated agents' streamed steps are reduced the same way on every agent type. Observers of a plain Agent run (`agent.observe()`) now also get each step's content, and their `onFinish` reports the run's text.
