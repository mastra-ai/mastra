---
'@mastra/observability': patch
---

Fixed crash when workflow is invoked via HTTP API with observability enabled. The BaseSpan constructor now handles both RequestContext class instances and plain objects, preventing the 'requestContext.size is not a function' error.
