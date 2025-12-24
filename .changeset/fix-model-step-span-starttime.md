---
'@mastra/core': patch
---

Fix MODEL_STEP span startTime appearing later than expected

The MODEL_STEP span was being created when the step-start chunk arrived (after the model API call completed), causing the span's startTime to appear close to its endTime rather than accurately reflecting when execution began.

This fix ensures MODEL_STEP spans capture the complete duration of LLM execution steps, including API call latency, by starting the span at execution initiation rather than upon response streaming.

**Changes:**
- Made `startStep()` public on `ModelSpanTracker` for early span creation
- Added `updateStep()` method to update span metadata when step-start arrives
- Call `modelSpanTracker?.startStep()` at LLM execution entry points

This implements an early-start + late-update pattern: spans begin when execution starts (capturing accurate timing) but receive payload details when the step-start chunk eventually arrives (enabling complete metadata population).
