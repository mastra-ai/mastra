---
'@mastra/core': patch
---

Fixed `writer` being undefined in `processOutputStream` for all output processors. The root cause was that `processPart` in `ProcessorRunner` did not pass the `writer` to `executeWorkflowAsProcessor` in the outputStream phase. Since all user processors are wrapped into workflows via `combineProcessorsIntoWorkflow`, this meant no processor ever received a `writer`. Custom output processors (like guardrail processors) can now reliably use `writer.custom()` to emit stream events.
