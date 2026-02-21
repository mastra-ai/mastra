---
'@mastra/memory': patch
---

Improved Observational Memory activation to preserve more usable context after activation. Previously, activation could leave the agent with too much or too little context depending on how chunks aligned with the retention target.

- Activation now lands closer to the retention target by biasing chunk selection to slightly overshoot rather than undershoot
- Added safeguards to prevent activation from consuming too much context (95% ceiling and 1000-token floor)
- When pending tokens exceed `blockAfter`, activation now aggressively reduces context to unblock the conversation
- `bufferActivation` now accepts absolute token values (>= 1000) in addition to ratios (0–1), giving more precise control over when activation triggers
