---
'@mastra/evals': minor
---

Updated trajectory accuracy scorers for the discriminated union `TrajectoryStep` types.

**Code-based scorer** (`createTrajectoryAccuracyScorerCode`): Now reads `expectedTrajectory` from either the constructor option or `run.expectedTrajectory` (from dataset items), with dataset values taking precedence. Updated to work with `toolArgs`/`toolResult` properties on tool call steps.

**LLM-based scorer** (`createTrajectoryAccuracyScorerLLM`): Same `expectedTrajectory` fallback pattern. Updated trajectory formatting for discriminated union step types.

**New unified trajectory scorer** (`createTrajectoryScorerCode`): Multi-dimensional trajectory evaluation that checks accuracy, efficiency, blacklist violations, and tool failure patterns in a single pass. Supports per-item `TrajectoryExpectation` from datasets, with static defaults. Returns an overall score composed from weighted sub-dimensions.

**New trajectory utility functions**: `checkTrajectoryEfficiency`, `checkTrajectoryBlacklist`, `analyzeToolFailures` — reusable building blocks for custom trajectory scorers.
