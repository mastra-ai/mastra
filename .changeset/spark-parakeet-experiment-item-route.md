---
'@internal/playground': patch
---

Experiment result details now open at a dedicated URL. Clicking a result in an experiment's Results tab navigates to `/experiments/{experimentId}/items/{itemId}`, so item details can be shared, deep-linked, and closed with the browser back button. The detail view renders as a floating full-height panel of rounded cards (no opaque backdrop container) that scrolls internally and can be resized with the design-system panel separator on its left edge (up to half the page). While an item is open, PageUp/PageDown move between items and Escape closes it — regardless of where focus is, as long as you're not typing in a field or another dialog. Breadcrumbs show Experiments / {experiment} / Items / {item}.

Dataset items follow the same pattern: clicking an item on a dataset page navigates to `/datasets/{datasetId}/items/{itemId}` and opens the item panel over the list, with the same resize, PageUp/PageDown, and Escape behavior, plus Datasets / {dataset} / Items / {item} breadcrumbs with a clickable dataset crumb.
