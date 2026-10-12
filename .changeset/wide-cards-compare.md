---
'@internal/playground': patch
---

Reworked the experiments comparison page. Each item's input and ground truth are now shown by default as cards, and long content is clipped with a fade and an "Expand" button. Outputs use the same cards, and agent outputs show their text as markdown. Experiment columns are wider, and the table fades at its edges when it scrolls horizontally.

Each experiment column now opens with a summary of the run: agent, creation date, errors, average score, average duration and per-scorer averages. Each item shows its duration and scores. Contenders show how each value moved against the baseline, and lower durations and error counts count as improvements.

Click a column's star badge to make that experiment the baseline. The breadcrumb now reads "Comparing N experiments". Hover it to see the compared experiments by name, with the baseline tagged.
