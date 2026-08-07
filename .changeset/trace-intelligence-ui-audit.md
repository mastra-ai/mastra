---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Reworked the Trace Intelligence views for clarity. The flow chart now has drag-to-reorder column headers with signal descriptions on hover, SIGNALS/THEMES gutter labels, and a play control below the timeline; the bottom distribution rail and stage legend are gone, and clicking a theme opens its details while isolating it in the flow. Compare uses two identical movable points instead of A/B markers and reports deltas as percentages. Lifelines rows fill the area under each theme's share and show instant point tooltips. The theme details panel gains page-numbered examples, a plain-language share sentence, a hue-colored signal heading, and a Trend section with a trace-count-over-time chart replacing the clustering-state history list. Each view explains itself with a one-line description, a data-context line, and a "What is this?" popover.
