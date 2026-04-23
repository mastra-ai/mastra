---
'@mastra/agent-browser': patch
---

Fixed browser_evaluate tool to correctly return values from expression-style scripts. Previously, bare expressions like `document.querySelectorAll('a').length` were wrapped in an IIFE without a `return` statement, causing the result to always be `undefined`. The tool now detects whether the script contains an explicit `return` and automatically adds one for expression-style scripts.
