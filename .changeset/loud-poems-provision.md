---
'create-factory': patch
---

Removed the Railway sandbox settings from the generated Factory template's `.env.schema` and README. They advertised a cloud sandbox provider the template cannot select, so setting `RAILWAY_API_TOKEN` quietly did nothing and projects kept running in the non-isolated local sandbox. Cloud sandboxes now come from Mastra Platform, and the sandbox docs say so. Also dropped `MASTRACODE_SANDBOX_PROVIDER` and `MASTRACODE_SANDBOX_IDLE_MINUTES`, which the template reads nowhere.
