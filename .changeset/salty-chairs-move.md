---
'@mastra/core': patch
---

Fixed writer being undefined in processOutputResult. The writer was not being passed to runOutputProcessors in the outer MastraModelOutput finish handler, so custom output processors could not emit stream events when processing the final result.
