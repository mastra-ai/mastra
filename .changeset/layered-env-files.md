---
'@mastra/deployer': patch
'mastra': patch
---

Layer default dotenv files from base to environment-specific overrides and preserve inherited shell environment variables in `mastra dev`.

For example, when `.env` contains `API_URL=https://api.example.com` and `.env.local` contains `API_URL=http://localhost:3000`, Mastra loads both files and uses the `.env.local` value.
