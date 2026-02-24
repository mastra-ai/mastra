---
'@mastra/playground-ui': patch
---

Refactor ItemList selection pattern across dataset views. Checkbox cells now use a dedicated `LabelCell` component placed outside `RowButton` as a sibling in `ItemList.Row`. Replaced `Badge` with `Chip` in experiments toolbar for consistency. Experiment comparison selection now keeps the first pick and replaces the most recent when selecting a third item.
