---
'@mastra/playground-ui': minor
---

`Combobox` fields now search right in the field. A single-select `Combobox` with the default variant inside a `Field` shows its value in a text field you type into to filter, instead of opening a separate search row in the popup. The selected option's `start` icon shows in the field.

Everything else keeps the trigger with the search in the popup: comboboxes outside a `Field` (toolbars, breadcrumbs, inline pickers), multiple selection, `ghost` and icon-size triggers, and non-text placeholders. The props are unchanged.
