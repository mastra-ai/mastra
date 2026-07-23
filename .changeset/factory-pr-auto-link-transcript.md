---
'@mastra/factory': patch
'mastra': patch
---

Link opened pull requests to their Factory work item even when the agent pushed its own branch, by matching the PR URL against successful `gh pr create` calls in candidate items' bound-session transcripts; log swallowed PR provenance-recording failures instead of hiding them
