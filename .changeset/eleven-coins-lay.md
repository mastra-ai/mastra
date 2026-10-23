---
'@mastra/inngest': patch
---

Fixed `InngestAgent.resume()` to reject invalid `modelSettings.timeout` values with a `TypeError` before dispatching the resume, leaving suspended runs available for a retry. Raised the `@mastra/core` peer dependency minimum to `1.80.0-0` for shared timeout validation support.
