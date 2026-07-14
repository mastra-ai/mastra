---
'@mastra/core': patch
---

Fixed `Memory` `generateTitle` never firing for durable agents created with `createEventedAgent` (including Inngest). Thread titles now generate and persist on the durable path when `generateTitle` is configured, including when Observational Memory is enabled. Existing thread titles are preserved.
