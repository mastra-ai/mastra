---
'@mastra/factory': patch
---

Fixed observational-memory settings not reaching sessions that were already running. Changing the observer or reflector model only applied to sessions created afterwards, so a review session that started on a model you can't run kept failing on every message even after you fixed the setting. Each message now reconciles the session against your stored settings, so the next message uses the model you picked.

The chat also stops reporting an observational-memory failure as an anonymous run error: the notice names the role that failed and links straight to the memory settings.

Only the models reconcile mid-session. Thresholds still take effect on the following run, because memory is built before the message is processed.
