---
'@mastra/playground-ui': patch
---

Fixed the multiple-select `Combobox` so `allowCustomValue` and `onInputValueChange` work as they do on the single select. Typed text is offered as an option and becomes a chip when picked. A selected value that `options` does not list now keeps its chip and stays in the value when another option is picked.
