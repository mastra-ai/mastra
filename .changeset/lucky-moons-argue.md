---
'@mastra/factory': patch
---

Factory projects now have their own configurable observational-memory settings. Board runs and channel sessions hydrate from the factory project's shared settings row (falling back to built-in defaults) instead of any individual user's personal configuration, and the OM config routes accept a `factoryId` to read and update the factory-scoped row. The Models settings page is split into Factory and User tabs so factory-wide defaults and personal chat settings are edited separately.
