---
'@mastra/client-js': patch
---

Added client SDK methods for dataset experiments and item generation.

- Added `triggerExperiment()` method to dataset resources for running experiments with configurable target type and ID
- Added `generateItems()` method for LLM-powered test data generation
- Added `clusterFailures()` method for analyzing experiment failures
- Added TypeScript types for new dataset and experiment API payloads
