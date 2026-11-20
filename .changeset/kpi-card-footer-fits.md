---
'@mastra/playground-ui': patch
---

Fixed `MetricsKpiCard` footers running past the card's edge when the card is narrow, such as in a small `MetricsCardGroup` cell. A long detail line now truncates, so the "vs …" previous value stays inside the card.
