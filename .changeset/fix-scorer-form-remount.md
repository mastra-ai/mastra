---
'@internal/playground': patch
---

Fixed a regression where the Studio Layout swapped its DOM tree once auth capabilities finished loading, which unmounted and remounted the active page. On the Create Scorer page this wiped the Name and Description inputs and reset the form, so submitting failed with "Name is required". The Layout now keeps a single stable wrapper across auth states.
