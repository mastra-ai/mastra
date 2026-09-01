---
'@mastra/factory': patch
---

Fixed session activity lagging behind reality: board cards and sidebar rows now refresh their working/initializing markers the moment a run starts or ends, instead of waiting on the next poll — runs shorter than a poll tick no longer slip past unseen. Board cards also stop claiming an automated run is in progress while its workspace is still being prepared.
