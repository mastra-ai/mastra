---
'@mastra/factory': patch
---

Factory no longer retries a skill run on its own after the model provider reports a rate limit or an exhausted quota. Before, the run ran up to five times, back to back, and every attempt could hit the same limit before anyone saw the failure. It now stops after the first attempt with the failure code `run_provider_limited` and shows up for a person right away, who can wait, review credentials, change the model, or press Retry. Other failed runs still retry on their own, and they now wait their backoff from the moment the run failed rather than from when it started, so a long run no longer retries immediately. Refs [#28696](https://github.com/mastra-ai/mastra/issues/28696).
