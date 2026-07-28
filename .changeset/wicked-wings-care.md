---
'@internal/playground': patch
---

Fixed experiment comparison cards rendering a blank link when an experiment had an empty name. They now fall back to the shortened experiment ID, matching the experiment lists.

Fixed the Experiment column on the experiments overview stretching to fit long names and squeezing the columns next to it. Long names now truncate instead.
