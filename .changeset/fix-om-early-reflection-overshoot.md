---
'@mastra/memory': patch
---

Fix observational memory early reflection activation overshoot. Idle-timeout (`activateAfterIdle`) and provider-change (`activateOnProviderChange`) triggers no longer activate a buffered reflection when the unreflected observation tail is smaller than the buffered reflection itself. This prevents active observations from collapsing to mostly-compressed content on short-gap turns (e.g. buffer at 15k observations, conversation pauses, early trigger would previously swap in ~4k reflection with ~0 raw tail). The buffered reflection is retained for the eventual threshold activation.
