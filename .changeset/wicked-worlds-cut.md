---
'@mastra/inngest': patch
---

Fixed durable agents on Inngest never running output processors, persisting memory, or generating thread titles at the end of a turn. Finalization was wrapped in a nested Inngest step, which the Inngest protocol does not support — in HTTP/serve deployments the run hung and never emitted its finish event. Finish side effects now run directly inside the existing durable step boundary, matching the built-in durable engine. Fixes #23815 and #22450.
