---
'@mastra/playground-ui': patch
---

Fixed Storybook stories and components to use design system color tokens instead of hardcoded color values. Replaced arbitrary hex values (like `#898989`, `#363636`, `rgba(255,255,255,0.15)`) with proper tokens (`text-neutral6`, `border-border1`, etc.) for better consistency across the UI.

Also removed the unused `SelectElement` component since its functionality is covered by the main `Select` component.
