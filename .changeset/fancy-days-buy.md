---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Improved the datasets experience in Studio: creating and editing a dataset now happens on dedicated pages (wrapped in a card) with proper breadcrumbs instead of dialogs, the dataset breadcrumb links to the dataset while a separate arrow opens the dataset switcher, item comparison moved to a path-based URL and is started from a new "Compare with" section in the item side panel, item checkboxes are always visible with contextual actions consolidated into a single "{n} selected" dropdown with a destructive Delete Items entry, experiment rows open the global experiment page (the dataset-scoped experiment route was removed), and the "Run Experiment" button keeps a stable label. Also improved dataset version selection when running experiments (with an inline old-version notice next to the items search and a link-style "Return to latest" action), and dataset item creation with a spacious sidebar and larger JSON editors.
