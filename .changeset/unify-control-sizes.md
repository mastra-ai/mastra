---
'@mastra/playground-ui': patch
---

Unified form control sizes on the Button scale. The duplicate `default` size (identical to `md`) was removed from `Input`, `InputGroup`, `Textarea`, `ButtonsGroup`, `TextFieldBlock` and `SearchFieldBlock` — use `md` instead. `lg` is now 28px (with 14px text) across all text controls so a large input and a large button line up in the same row; icon buttons (`icon-lg`) keep their 32px size. `Textarea` gained an `xs` size, and the `form-default` size token was removed (use `form-md`).
