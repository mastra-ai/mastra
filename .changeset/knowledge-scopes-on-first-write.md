---
'@mastra/core': patch
---

Fixed read-only Knowledge runs filling storage with empty scopes. A run that only searches, lists or reads Knowledge, and pinned-context delivery each turn, no longer creates the run's `resource:`, `thread:` or other held scopes. A held scope is created, with its template pages and its `belongsTo` placement, the first time a run writes Knowledge (`knowledge_page`, `knowledge_note`, `knowledge_pin`).

Before, a Slack agent that only answered questions with `knowledge_search` created an empty `resource:slack:<userId>` and `thread:` scope for every user and conversation, which filled the Studio tree.

A scope with no pages yet reads as not found until the first write creates it.
