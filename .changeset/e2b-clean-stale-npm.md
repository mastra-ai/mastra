---
'@mastra/e2b': patch
---

Fixed `npm`, `npx`, and `npm install -g` failing with "Class extends value undefined" in sandboxes built from `createDefaultMountableTemplate()`. The template now removes the base image's old npm and corepack before installing Node. Existing cached default templates rebuild once.
