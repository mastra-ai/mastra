---
'@mastra/playground-ui': patch
---

Rebuilt FilterBar popups on the design-system Combobox primitive. The typeahead input and chip editors now get keyboard navigation, highlighting, and combobox ARIA semantics from the shared primitive instead of a custom listbox. The in-progress filter (field › operator) is now shown as an inline chip next to the input instead of a breadcrumb inside the popup. Free-text values get an inline Apply button, and fields accept a `type` (`text` | `number` | `boolean`): number fields validate the typed value and use a decimal keyboard, boolean fields offer strict True/False suggestions.
