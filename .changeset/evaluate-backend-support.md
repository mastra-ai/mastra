---
'@mastra/core': minor
'@mastra/server': minor
---

Added dataset-agent association and experiment status tracking for the Evaluate workflow.

- **Dataset targeting**: Added `targetType` and `targetIds` fields to datasets, enabling association with agents, scorers, or workflows. Datasets can now be linked to multiple entities.
- **Experiment status**: Added `status` field to experiment results (`'needs-review'`, `'reviewed'`, `'complete'`) for review queue workflow.
- **Dataset experiment routes**: Added API endpoints for triggering experiments from a dataset with configurable target type and target ID.
- **LLM data generation**: Added endpoint for generating dataset items using an LLM with configurable count and prompt.
- **Failure analysis**: Added endpoint for clustering experiment failures and proposing tags using LLM analysis.
