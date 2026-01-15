---
'@mastra/playground-ui': patch
---

Consolidate UI components into design system folder. Moves all UI primitives from `src/components/ui/` to `src/ds/components/` to establish a single source of truth for UI components. Import paths updated across the codebase. No API changes - all exports remain the same.
