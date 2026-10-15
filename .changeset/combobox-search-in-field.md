---
'@mastra/playground-ui': minor
---

`Combobox` form fields now search right in the field. Inside a `Field`, a default `Combobox` is a text field you type into to filter, instead of a button that opens a separate search row. With `multiple`, the picks show as removable chips in the field (× or Backspace removes one) instead of "N selected". The selected option's `start` icon shows in a single-select field.

Everything else keeps the trigger with the search in the popup: comboboxes outside a `Field` (toolbars, breadcrumbs, inline pickers), `ghost` and icon-size triggers, and non-text placeholders. The props are unchanged.
