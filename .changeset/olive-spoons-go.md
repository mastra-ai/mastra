---
'@mastra/factory': minor
---

Added comments to Factory work items. Every work item now stores a comment thread with quoted replies and @mentions, served by new routes for listing, posting, editing and deleting.

- Posts are idempotent: a client token means a retried send never duplicates a comment
- Edits carry the revision they were written against, so two people editing the same comment get a conflict instead of silent last-write-wins
- Deletes are tombstones, so ordering and replies stay stable
- Listing accepts `?around=<commentId>`, returning the page that holds that comment plus everything newer, so a link to a comment opens on it in one request
- A mention writes an attention record, and the attention inbox now merges mentions with automation failures instead of serving one hardcoded kind
