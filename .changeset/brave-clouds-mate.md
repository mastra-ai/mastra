---
'@mastra/core': patch
---

Fixed writer being undefined in processOutputStream when output processors run on data-\* chunks in the workflow loop stream. This ensures custom output processors (like guardrail processors) can emit stream events via writer.custom() in all execution paths.
