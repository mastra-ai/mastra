---
'@mastra/factory': patch
---

Fixed deleting an intake rule being slow on remote databases and breaking other open rule edits. A delete now removes only the deleted rule instead of rewriting every rule after it, so the remaining rules keep their order and revision and edits opened before the delete still save.
