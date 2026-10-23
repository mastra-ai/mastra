---
'@mastra/core': patch
---

Fixed `mapUserToResourceId` being ignored when defined as a method on a `MastraAuthProvider` subclass. Subclass methods now work the same as passing `mapUserToResourceId` as a constructor option.
