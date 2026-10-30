---
'@mastra/playground-ui': patch
---

Fixed markdown tables, lists and paragraphs losing their cell padding, borders, bullets and spacing when a notice's stylesheet loaded before the app's Tailwind entry. The `Notice` and `GrainFill` stylesheets now declare the full CSS layer order, so Tailwind's reset no longer outranks the design system's component styles.
