---
'@mastra/playground-ui': patch
---

Form text and destructive red now match across controls:

- Select and Combobox show the picked value in medium weight, matching text typed into an Input.
- Validation messages under a field are 13px, the same size as the label and value, instead of 12px.
- `red-400` moves onto the same lightness step as the other hues, so destructive text in dark mode reads as red instead of salmon.
- Destructive badges use the same light text as the other status badges, so their label stays readable on the red tint.
- Metrics KPI values drop from semibold to the medium weight of the title role, so no text in the design system goes above 500.
