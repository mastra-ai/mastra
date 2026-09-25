---
'@mastra/connect': patch
---

The Notion knowledge importer now captures nested page content. The block fetch is a bounded depth-first walk that descends into `has_children` blocks — column layouts, toggles, and tables — so pages built with those structures no longer import as empty. Text extraction also covers `code`, `to_do`, and `table_row` blocks, and the per-page fetch budget is now a shared request budget (8 requests) across nesting levels.
