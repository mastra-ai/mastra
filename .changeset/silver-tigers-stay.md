---
'@mastra/client-js': patch
'mastra': patch
---

Redesigned the dataset experiment comparison view in Studio into a three-column layout: the item list, the baseline result, and the contender result. Selecting an item now shows both runs side by side with their output, scores and scorer reasons, comment, metadata, and run errors, so it is easier to see what changed between two experiments.

Also corrected the `DatasetExperimentResult` client type to match what the API actually returns: `error` is a structured `{ message, stack?, code? }` object rather than a string, and `scores` is optional since the experiment results endpoint returns raw result rows without aggregated scorer runs.
