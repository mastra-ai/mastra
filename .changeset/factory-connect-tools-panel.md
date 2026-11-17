---
'@mastra/factory': patch
---

Fixed **Settings › Tools** saying Mastra Connect tools are off when a Factory sets the `tools` option, even when that option uses Connect tools (#30579). The page now lists the Platform project's connections whenever the Factory has Platform credentials and `MASTRA_PROJECT_ID`, and says that session tools come from code. When either one is missing, the page names it instead of listing every possible cause.
