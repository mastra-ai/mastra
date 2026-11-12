---
'@mastra/github-signals': patch
---

Fixed delivery of authorized review comments and inline findings even when bot summaries change or CI status is unknown. Limit comment bursts to ten findings and a counted overflow notice per poll.
