---
'@mastra/fastembed': patch
---

Fixed embedding models growing by hundreds of MB over long-running processes. ONNX Runtime sessions now run without the CPU memory arena, which kept every buffer it allocated for each new input size.
