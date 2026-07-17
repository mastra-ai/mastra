---
'create-softwarefactory': patch
---

Added the create-softwarefactory CLI. It scaffolds a Mastra Software Factory project: pick a model provider, set up the Postgres database, and optionally connect WorkOS sign-in, a GitHub App (guided manual entry), and Linear. The CLI writes a ready-to-run .env and prints the dev URLs when it finishes.

```bash
npm create softwarefactory my-factory
cd my-factory
npm run db:up
npm run dev
```
