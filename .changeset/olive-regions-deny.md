---
'@mastra/core': minor
---

Added dynamic destination scopes for knowledge importer cron triggers: a trigger can now provide a resolveBindings callback that is resolved at each fire, so importers can sync into a changing set of scopes without re-registering.
