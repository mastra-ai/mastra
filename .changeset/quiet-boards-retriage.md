---
'@mastra/factory': patch
---

Fixed issue edits and comments queuing a `factory-triage` run for cards that shouldn't be re-triaged. The default GitHub and GitLab re-triage rules now only fire for cards on the Work board, so cards on custom boards (including ones in working or terminal phases) are left alone. GitLab cards in Execute, Review, Done, or Canceled are also no longer re-triaged, matching GitHub. Custom boards that want re-triage can add their own rule.
