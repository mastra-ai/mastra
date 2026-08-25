---
'@mastra/playground-ui': patch
---

Improved the datasets experience in Studio: creating and editing a dataset now happens on dedicated pages with proper breadcrumbs instead of dialogs, the dataset breadcrumb links to the dataset while a separate arrow opens the dataset switcher, item comparison moved to a path-based URL and is started from a new "Compare with" section in the item side panel, item checkboxes are always visible with contextual actions appearing once items are selected (replacing the "Select &" menu), and the "Run Experiment" button keeps a stable label. Follow-up polish: experiment rows now open the global experiment page (the dataset-scoped experiment route was removed), the dataset breadcrumb matches sibling crumb styling, the items tab content aligns with the header padding, and selection actions are consolidated into a single "{n} selected" dropdown with a destructive Delete Items entry.
