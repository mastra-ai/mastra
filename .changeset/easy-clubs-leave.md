---
'@mastra/playground-ui': patch
---

Fixed crash during template installation by ensuring error values from stream events are converted to strings before being passed to the UI. This prevents the 'e?.includes is not a function' TypeError when the server returns non-string error payloads.
