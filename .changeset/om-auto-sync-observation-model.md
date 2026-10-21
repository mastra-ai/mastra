---
'@mastra/memory': patch
---

Fixed observational memory set to `'auto'` sometimes calling `google/gemini-2.5-flash` without a Google key. When a turn crossed the observation threshold and observed right away, the observer lost track of the main model and fell back to Gemini, so turns failed for accounts without Google with `Could not find API key … google/gemini-2.5-flash`. That observation now uses the step's main model, as the other observation paths already did. When `canUseProvider` is set and no main model can be found, `'auto'` now fails with a clear error instead of picking a Gemini model it cannot call.
