---
'@mastra/playground-ui': patch
---

No visual change: the Combobox parts let Base UI position the list under the field, instead of tracking the field element themselves. `ComboboxChips` now renders its chips inside Base UI's `InputGroup`.
