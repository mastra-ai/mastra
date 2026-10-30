---
'@mastra/playground-ui': patch
'mastra': patch
---

Fixed markdown headings, lists and spacing rendering unstyled in apps that import `@mastra/playground-ui` components with their own Tailwind build (such as Factory). The Notice and GrainFill stylesheets now declare the full CSS layer order before their rules, so Tailwind's base styles no longer outrank component styles.
