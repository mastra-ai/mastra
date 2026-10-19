---
'@mastra/playground-ui': patch
---

`ComboboxChips` now wraps its chips in Base UI's `InputGroup`, so the list opens under the chips field through Base UI's own anchoring. Nothing changes visually; the Combobox parts no longer track the field element in React state.
