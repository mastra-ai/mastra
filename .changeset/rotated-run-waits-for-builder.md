---
'@mastra/factory': patch
---

Fixed self-review not recording its verdict when the builder's own move started it. The Self-review kickoff was delivered into the builder's still-running turn, which only had the builder's tools, so `factory_record_review_verdict` was missing and the pull request never opened. A phase that starts after the previous agent's move now waits for that agent's run to end and starts in a fresh run with its own tools. A run still going when its card moves on is told its part is done, instead of being shown a role whose tools it does not have.
