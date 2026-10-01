---
'@mastra/playground-ui': patch
---

Fixed several layout and input problems in auto-generated forms (for example tool and workflow run forms):

- A long label that wraps keeps its required asterisk right after the text instead of at the far end of the row.
- Fields typed `T | null` (for example an optional region) render as one optional input instead of two unlabeled inputs separated by "OR".
- Key-value fields render each pair as one row (key, value, remove) without a nested card.
- Number fields keep a number while you type, so submitting with Enter sends a number instead of failing validation.
