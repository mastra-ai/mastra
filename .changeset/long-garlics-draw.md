---
'@internal/playground': patch
---

Fixed experiment span badges rendering without their colour wash.

The badges set `backgroundColor` to a Tailwind class name (`bg-oklch(...)`), which is not valid CSS, so the tint never painted. They now derive the wash from the shared span type tokens and use the same palette as the trace timeline instead of a second local copy.

**Changed.** The model switcher, file browser, integration pages, template failure view and agent builder layouts used Tailwind palette classes, hex values and the `font-sans` alias. They now use the design system roles, so those pages follow the theme instead of staying dark.
