---
"@mastra/core": patch
---

Fixed messages not being persisted when SemanticRecall and ObservationalMemory processors are both enabled. The processorStates map was missing from the passThrough object in createStepFromProcessor, causing it to be lost between chained processor workflow steps. OM's turn.end() never executed, so messages were never saved to the database.
