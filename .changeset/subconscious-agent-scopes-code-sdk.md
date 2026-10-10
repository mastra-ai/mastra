---
'@mastra/code-sdk': patch
---

Mastra Code now passes the session's Knowledge org to its agent as an `org:<id>` scope, so Subconscious curates under the same org as the session. Factory sessions whose org could not be resolved still skip curation.
