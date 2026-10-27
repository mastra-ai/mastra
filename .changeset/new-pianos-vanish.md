---
'create-factory': minor
---

Changed which starter `create-factory` scaffolds. By default it now uses the platform template ([template-factory](https://github.com/mastra-ai/template-factory)). With `--no-platform` it uses the new self-hosted template ([template-factory-self-hosted](https://github.com/mastra-ai/template-factory-self-hosted)). That template runs on PostgreSQL, WorkOS, a GitHub App, and local sandboxes, with no Mastra platform services. Passing `--template` still overrides both.

The setup also generates a `FACTORY_CREDENTIAL_ENCRYPTION_KEY` in `.env` when the template declares an empty one, so the self-hosted template starts with stored credentials encrypted instead of failing on a missing key.

```bash
npm create factory@latest -- --no-platform
```
