---
'@mastra/factory': patch
---

Make shared-factory credentials discoverable and shareable. The providers config route now reports `orgKey` per provider (an org-wide API key exists, even when shadowed by a personal credential) and `orgKeyAdmin` on the envelope (whether the caller may write org-scoped keys). The Studio UI uses this to default factory-setup API keys to org scope, warn when a factory default model is backed by a personal-only credential, show Personal/Org key badges, and replace the composer with an actionable notice when the signed-in user has no credential for the factory default model's provider.
