---
'@mastra/core': patch
---

Durable agents now produce complete observability traces matching the non-durable path — AGENT_RUN root span, MODEL_GENERATION per iteration, MODEL_STEP/MODEL_INFERENCE closing correctly, and TOOL_CALL spans nested under model_step
