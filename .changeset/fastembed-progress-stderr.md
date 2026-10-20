---
'@mastra/fastembed': patch
---

Fixed model downloads contaminating standard output, including Hugging Face download messages for dense and sparse models. Download notices use standard error, and quiet downloads remain silent.
