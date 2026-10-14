---
'@mastra/core': patch
---

Knowledge treats `project:<id>` and `project:<id>:thread:<threadId>` as host-vouched identity scopes, alongside `org:` and `resource:`. Importer and child scope templates can no longer create them.
