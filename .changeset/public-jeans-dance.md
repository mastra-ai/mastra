---
'@mastra/playground-ui': patch
---

Aligned AlertDialog visual styling with Dialog component for design system consistency. AlertDialog now uses the same surface tokens, border radius, shadow, animation curves, and typography scale as Dialog. The accessibility primitive remains separate (preserves `role="alertdialog"` and explicit Action/Cancel semantics) — only the visual shell was synced. Also added `AlertDialog.Body` for parity with Dialog.
