---
'@mastra/core': patch
---

Fixed notifications whose immediate delivery failed from staying undeliverable. A signal that no thread owner could accept is now retried by the notification dispatcher, up to five attempts, instead of sitting pending forever. The retry keeps the routing requirement the sender asked for, so a wake that requires a claimed thread owner still reaches that owner rather than starting the thread in whichever process runs the dispatch.
