---
'@mastra/playground-ui': patch
---

Fixed the MainSidebar mobile menu button staying visible on desktop. Its hide rule used a zero-specificity selector, so an app stylesheet loaded after the design system's could win and leave the hamburger next to the desktop sidebar.
