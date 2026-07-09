---
'@mastra/core': patch
---

Fixed slow agent streaming with remote storage: output processors run an internal workflow once per streamed chunk, and each run performed a storage read that could never hit (the run id is freshly generated and these transient workflows never persist a snapshot). On high-latency databases this throttled token delivery to roughly one storage round-trip per token. The guaranteed-miss read is now skipped for freshly-created transient runs. (#19015)
