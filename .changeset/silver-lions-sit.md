---
'@mastra/core': patch
---

Added a patch to filter out system messages that were stored in the db via an old memory bug that was patched long ago (see issue 6689). Users upgrading from the old version that still had the bug would see errors when the memory messages were retrieved from the db
