---
'create-factory': patch
---

Resolve or create the project's production environment during platform setup and write its ID as `MASTRA_ENVIRONMENT_ID` in `.env`, so locally running factories can use PlatformSandbox without deploying the app.
