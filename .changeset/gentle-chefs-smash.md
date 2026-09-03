---
'@mastra/factory': patch
---

Fixed Factory-authored pull requests to resume their original session for inline reviewer feedback while leaving regular pull requests out of autonomous fixes. Factory now also creates and starts an initial Review session, or re-review session after completion, when a trusted maintainer requests the configured GitHub App as a reviewer.
