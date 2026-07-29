---
'@mastra/factory': patch
---

Fixed manual issue triage in platform deployments. The triage runner is now automatically derived from the mounted controller, so manual triage no longer returns 503 when no explicit runner is configured. The manual triage endpoint now shares the same wrapper as webhook-triggered triage, ensuring labels and default model resolution are handled consistently.
