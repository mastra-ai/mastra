---
'@mastra/playground-ui': minor
---

Added Evaluate tab to the agent playground with full dataset management, scorer editing, experiment execution, and review workflow.

**Evaluate tab** — A new sidebar-driven tab for managing datasets, scorers, and experiments within the agent playground. Key features:

- **Dataset management**: Create, attach/detach, and browse datasets. Inline item editing and deletion. Background LLM-powered test data generation with review-before-add flow.
- **Scorer editor**: Create and edit scorers with test items, linked test datasets, configurable score ranges, and model selection. Run scorer experiments directly from the editor.
- **Experiment runner**: Trigger experiments from dataset or scorer views with correct target routing (agent, scorer, or workflow). Past runs displayed with pass/fail counts and auto-polling for status updates.
- **Collapsible sidebar sections**: Datasets, Scorers, and Experiments sections are collapsible with search-enabled attach dialogs.

**Review tab** — A dedicated review workflow for experiment results:

- Tag-based organization with dataset-level tag vocabulary and bulk tagging
- LLM-powered analysis ("Analyze untagged/selected") that proposes tags with reasons, using existing tags when applicable
- Thumbs up/down ratings and comments persisted via feedback API
- Mark items as complete for audit trail
- Completed items section with read-only display
