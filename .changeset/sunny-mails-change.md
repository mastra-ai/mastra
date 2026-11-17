---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed resumed workflow runs sampling again. A resume now keeps the suspended run's sampling decision and trace settings and nests under its span on the default, evented and Inngest engines. A resume of a run the sampler did not record stays unrecorded, so scorers do not run for it. This also applies to a durable agent run that another process resumes.
