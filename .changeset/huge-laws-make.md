---
'create-factory': patch
---

Improved the create-factory sign-in and success experience:

- When no Mastra platform session exists, the CLI now pauses with "Mastra account is required, press enter to continue..." before opening the browser auth flow instead of opening it unannounced.
- The success message now summarizes the infrastructure provisioned on Mastra platform (project, Postgres database, credentials in .env), notes that deployed code agent sessions run inside Mastra platform sandboxes, and links directly to the new project on https://projects.mastra.ai for managing project settings.
