---
'@mastra/factory': patch
---

`factory_start_session` now takes an optional `model`. A side session started without one inherits the model of the session that started it, instead of the server default, and falls back to that default when the parent has no model set. A model the session's credentials cannot run is rejected before the session is created. A run that dies on a provider usage or quota limit reports that reason instead of a bare "Bad Request".
