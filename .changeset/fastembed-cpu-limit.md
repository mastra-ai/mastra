---
'@mastra/fastembed': patch
---

Fixed local embeddings slowing down the whole server in CPU-limited containers. The embedder started one thread per machine core and kept them busy-waiting between requests, so a container limited to 2 CPUs on an 18-core host was paused by the kernel on every scheduling period: one embedding took 1.0 s and stalled the rest of the process for up to 1.4 s. The thread count now follows the CPUs the process may use and idle threads sleep, which brings that embedding to 0.14 s and the CPU used to an eighth.
