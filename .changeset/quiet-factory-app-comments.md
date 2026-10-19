---
'@mastra/factory': patch
---

Factory-managed builder sessions are no longer woken by the Factory App's own pull request comments, such as approvals, demo links, or progress notes. Only an App comment whose first line is a request-changes verdict (`Verdict: request changes`) still reaches the builder, matching the default pull request comment rule. Sessions that subscribed explicitly, and comments from other senders, are unaffected.
