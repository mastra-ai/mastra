---
'@mastra/memory': minor
---

Internal restructuring of experimental subconscious curation: the curate agent entry now owns its
own trigger configuration, and curation is evaluated from pipeline completion rather than the
memory engine's lifecycle. Deprecated top-level curation options are still honoured via
translation at config resolution.
