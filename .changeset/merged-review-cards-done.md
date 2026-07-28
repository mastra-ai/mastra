---
'@mastra/factory': patch
---

Move merged pull request Review cards to Done automatically. When a PR merge event binds to the PR's own Review card, the built-in rule now transitions the card to Done (delivering a note to the card's active session when one exists) instead of attempting to message a work session that may not exist. Merge events bound to a provenance-linked Work item still only remind that agent to assess completion and never auto-complete the Work item.
