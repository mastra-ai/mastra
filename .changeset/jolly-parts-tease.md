---
'@mastra/core': patch
---

Aligned A2AAgent streams with the regular Agent stream contract. A2A streams now emit a leading start chunk on fresh runs (skipped when resuming, matching Agent behavior) and the finish chunk now carries the Agent-shaped payload (stepResult.reason, output.usage) so downstream consumers can treat sub-agent streams uniformly. The previous flat finishReason and usage fields are still included for backward compatibility but are deprecated.
