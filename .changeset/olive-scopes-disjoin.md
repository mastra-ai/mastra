---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Enforced the full Knowledge proposal visibility disjunction — (proposer-context read AND target read) OR direct write authority — in list and single-ID storage reads across adapters, closing a leak that exposed pending proposals to target-only readonly readers and letting reReview clone hidden payloads.
