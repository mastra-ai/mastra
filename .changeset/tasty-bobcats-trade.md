---
'@mastra/factory': minor
---

Removed the per-project `reviewTestChecksEnabled` setting. `source_control_publish_test_check` now publishes whenever a review skill calls it, so the review skill decides whether a change request gets a `Factory Review / tests` check. The tool still refuses a head that is not the change request's current head, and still reports a provider that cannot publish commit checks. Projects no longer return the setting. `PATCH /web/factory/projects/:id` accepts it for one more release and ignores it.
