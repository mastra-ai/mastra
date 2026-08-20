---
'@mastra/factory': patch
'@mastra/code-sdk': patch
'@mastra/core': patch
---

Fixed shared threads running with a stale model in multi-server deployments. The model selected for a mode is now re-read from the thread's persisted settings at the start of every run, so a model switch made in one browser session or server replica is picked up by all others instead of silently diverging until the next mode switch.
