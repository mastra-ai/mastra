---
'@mastra/client-js': patch
---

`GetWorkflowRunByIdResponse.serializedStepGraph` is typed as the core `SerializedStepFlowEntry[]`, like `GetWorkflowResponse.stepGraph`, instead of the generated route shape.
