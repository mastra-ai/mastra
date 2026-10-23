---
'@mastra/playground-ui': patch
---

Fixed chart y-axis labels showing extra zeros, such as $0.0 and $5.0. Dollar ticks now read $0, $2.5 and $5, and score ticks read 0, 0.25 and 1. Added `formatAxisUsd` for dollar y-axes.
