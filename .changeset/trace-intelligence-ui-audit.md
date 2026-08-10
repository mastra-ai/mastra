---
'@internal/playground': patch
---

Reworked the Trace Intelligence views for clarity.

**Flow**

- Column headers are sortable and show signal descriptions on hover.
- Horizontal SIGNALS and THEMES rules replace the distribution rail and stage legend.
- Clicking a theme opens its details and isolates it in the flow.

**Compare**

- Two identical movable points replace the A and B markers.
- Deltas now use percentages.

**Lifelines**

- Each row fills the area under the theme's share.
- Points show tooltips immediately.

**Theme details**

- Examples use page-numbered navigation.
- A plain-language sentence states the theme's share of traces.
- Signal headings are hue-colored.
- A Trend section charts trace count over time instead of listing clustering states.

Each view now states its purpose in one line and offers an info-icon tooltip.
