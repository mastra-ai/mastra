---
'@mastra/core': patch
---

Fixed requestContext not being forwarded to tools dynamically added by input processors (like ToolSearchProcessor). Tools returned from processInputStep are now converted through makeCoreTool with the original requestContext, so tool.execute() receives the correct context.
