---
'@mastra/factory': patch
---

Fixed observational memory in Factory web user sessions ignoring the stored memory settings. Sessions created from the web UI now start with the observer and reflector models, thresholds, and attachment preferences saved in your memory settings, instead of falling back to the built-in default model — which failed with a missing API key error when that provider was not configured.
