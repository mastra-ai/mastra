---
'@mastra/factory': patch
---

Factory no longer reports a stalled sandbox as "git is not installed". When the `git --version` check times out (exit 124), the failure is now reported as an unresponsive sandbox that can be retried. A genuinely missing git includes the real exit code and output. Sandbox start failures also name the provider's VM id, so they can be matched against provider logs even after the sandbox is recreated.
