---
'@mastra/mongodb': patch
---

Fixed MongoDB observational memory buffering so legacy records with `bufferedObservationChunks: null` can append chunks safely and continue storing chunk buffers as arrays after activation.
