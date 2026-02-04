---
'@mastra/core': patch
---

Fixed workspace skills being removed when custom inputProcessors are passed to generate() or stream() options. Previously, passing inputProcessors to these methods would completely replace the auto-derived processors (including SkillsProcessor), causing skill tools like skill-activate and skill-search to be unavailable. Now, custom inputProcessors correctly override only user-configured processors while preserving implicit processors for memory and skills. Fixes #12612.
