---
'@mastra/server': patch
---

Listing memory threads with fine-grained authorization now reads storage in batches of 100 and keeps only the requested page, instead of loading every matching thread at once. Totals and page contents are unchanged. If threads that share a timestamp span two batches, the list is read in one go instead, so no thread is missed.
