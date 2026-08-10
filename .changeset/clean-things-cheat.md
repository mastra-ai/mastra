---
'@mastra/core': patch
---

Fixed `Mastra.startWorkers()` so it no longer reads the schedules store on boot when the scheduler cannot start. Boot now skips that read if you set `scheduler: { enabled: false }` or `workers: false`. Storage adapters that need request or tenant context no longer warn on every boot. Automatic detection of persisted agent schedules and deferred notifications is unchanged when you do not opt out.
