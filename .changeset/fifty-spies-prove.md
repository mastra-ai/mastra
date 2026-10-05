---
'@mastra/playground-ui': patch
---

Fixed responsive layout classes being overridden in apps that load `@mastra/playground-ui/style.css` before their own styles. The workflow graph no longer loads a second copy of the stylesheet, so classes like `lg:block` and `lg:gap-x-32` apply again.
