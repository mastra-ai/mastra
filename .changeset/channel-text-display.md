---
'@mastra/core': minor
---

Added a per-adapter `textDisplay` channel option (`'progressive' | 'final'`) and per-run channel render overrides via the `channel.render` requestContext key. `'final'` accumulates the agent's text and posts it once when the run ends; `channel.render` lets a single run (e.g. a heartbeat) suppress its channel post (`false`) or override `textDisplay`/`toolDisplay`/`streaming` without changing the channel's configured options.
