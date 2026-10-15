---
'mastra': patch
---

Simplified the dataset page in Studio. Empty datasets now only show the dataset menu in the header, and hide the "Add tag" control, so the empty state focuses on adding items. Once a dataset has items, "Experiments" (with the same icon as the sidebar) and "New experiment" appear as compact actions in the top-right header. The breadcrumb now always shows the dataset name, even for datasets beyond the first page of the list, and the dataset version lives in the breadcrumb too (for example `Datasets / My dataset / Latest (v3)`), where you can switch to an older version. Each version in the version picker now shows when it was created.
