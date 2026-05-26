---
'@mastra/core': patch
---

Asset download errors now include the failing URL so callers can identify which media link broke and recover from it (e.g. drop the dead part on retry). The URL appears redacted (query string and fragment stripped) in the error message and in full on `error.details.url`.
