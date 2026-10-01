---
'@mastra/playground-ui': patch
---

Fixed several layout and input problems in auto-generated forms (for example tool and workflow run forms):

- Labels now sit above every control, so selects and date pickers fill the row like text inputs, and a long label keeps its required asterisk right after the text.
- Fields typed `T | null` (for example an optional region) render as one optional input instead of two unlabeled inputs separated by "OR".
- Key-value fields render each pair as one row (key, value, remove) without a nested card.
- Number fields keep a number while you type, so submitting with Enter sends a number instead of failing validation.
