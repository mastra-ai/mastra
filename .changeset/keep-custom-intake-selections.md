---
'@mastra/factory': patch
---

Fixed saving intake settings resetting the selections of custom Factory integrations. Toggling a built-in source such as GitHub used to drop any custom integration's saved choice, which then read back as enabled for every source. Saves now keep the stored selection of every integration the request does not mention.
