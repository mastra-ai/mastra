---
'@mastra/factory': patch
---

Fixed GitHub review feedback delivery to preserve the Factory session owner identity when waking work sessions, recover failed or stale delivered feedback with bounded retries, reconcile missed pull request updates by head commit so completed Review sessions run again, stop retrying after a subsequent PR update, resolve missing PR provenance from the authoring session branch, prepare missing Work bindings before dispatching feedback, and rehydrate reused Factory sessions with the project's current model and observational-memory settings before rule dispatch.
