---
'@mastra/daytona': patch
---

Switched from `@daytonaio/sdk` to `@daytona/sdk`, the new name Daytona publishes its SDK under. The code is identical, so `DaytonaSandbox` behaves the same. If your own code imports `Daytona` or `Image` from `@daytonaio/sdk`, for example to build a snapshot, install `@daytona/sdk` and update the import.
