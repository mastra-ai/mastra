---
'create-factory': patch
---

Fixed local Factory setup to provision the production environment and write `MASTRA_ENVIRONMENT_ID` to `.env`, enabling PlatformSandbox without deploying the app.

Added a template override to run sandbox commands locally while keeping cloud credentials configured:

```dotenv
SANDBOX_PROVIDER=local
```
