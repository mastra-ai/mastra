---
'@mastra/core': patch
---

Fixed dynamic workflow persistence dropping `initData: true` from `.map()` entries. Workflows using `.map({ key: { initData: true, path: 'field' } })` now survive `toStorableGraph` → validate → rehydrate and read from the workflow's initial input as they do in memory. Workflows already stored with the bug need to be saved again.
