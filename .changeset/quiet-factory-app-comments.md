---
'@mastra/factory': patch
---

Fixed unwanted builder wake-ups from Factory App pull request comments, such as approvals, demo links, and progress notes.

Comments that open with `Verdict: request changes` still reach the builder. Explicit subscriptions and comments from other senders are unchanged.
