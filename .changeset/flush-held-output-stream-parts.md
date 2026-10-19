---
'@mastra/core': patch
---

Fixed output stream processors dropping text they were still holding when a model stream ended. A reply shorter than one `BatchPartsProcessor` batch (for example with `emitOnNonText: false`) used to stream and save as empty; held parts are now released at the end of each model stream and passed through the processors that come after the one that held them.
