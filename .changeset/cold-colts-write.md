---
'create-mastra': patch
'mastra': patch
---

Improved create-mastra dependency installation by installing Mastra runtime packages together, reducing setup time and avoiding stalls between package installs.

Removed Prettier from the CLI install path so generated project setup no longer pulls in the prettier dependency.
