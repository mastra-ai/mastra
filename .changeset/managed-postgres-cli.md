---
'mastra': minor
---

Added managed Postgres provisioning to `mastra env db`. `mastra env db create --kind postgres` provisions a managed Postgres database on Mastra platform (running on Railway alongside your environment) and injects `POSTGRES_URL` into deploys. Deploy preflight also autoprovisions managed Postgres when a project requires `POSTGRES_URL` but the variable is missing, matching the existing Redis flow. Managed Postgres is always environment-scoped; `--shared` and `--region` are not accepted for this kind.
