---
'@mastra/core': patch
---

Fixed high CPU usage during agent streaming: the workflow engine's step payload deduplication re-serialized the accumulated streaming context on every chunk, which could pin a CPU core on long streamed responses. The comparison is now size-bounded, so streaming CPU scales linearly with output length. Fixes [#19373](https://github.com/mastra-ai/mastra/issues/19373).
