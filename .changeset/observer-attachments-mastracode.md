---
'mastracode': patch
---

Add an "Observe attachments" toggle in `/om` settings that controls whether
file and image attachments are forwarded to the Observer LLM. Turn it off when
running with a text-only observer model. Stored as `omObserveAttachments` in
global settings and seeded into the harness state at startup.
