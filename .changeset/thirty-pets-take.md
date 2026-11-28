---
'@mastra/server': patch
---

Fixed the route that cancels pending thread signals so it returns every cancelled id once the cancellation finished, including signals evented agents keep in their memory storage, and reports a failed cancellation as an error.
