---
'@mastra/factory': patch
---

Fixed builder sessions waking up for the Factory App's own pull request comments, such as approvals, demo links, and progress notes.

An App comment whose first line is `Verdict: request changes` still reaches the builder. Explicit subscriptions and comments from other senders are unchanged.
