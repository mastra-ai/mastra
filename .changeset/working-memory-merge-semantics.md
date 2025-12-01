---
"@mastra/memory": minor
---

Schema-based working memory now uses merge semantics instead of replace semantics.

**Before:** Each working memory update replaced the entire memory, causing data loss across conversation turns.

**After:** For schema-based working memory:
- Object fields are deep merged (existing fields preserved, only provided fields updated)
- Set a field to `null` to delete it
- Arrays are replaced entirely when provided

Template-based (Markdown) working memory retains the existing replace semantics.

This fixes issue #7775 where users building profile-like schemas would lose information from previous turns.

