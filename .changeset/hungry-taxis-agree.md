---
'mastra': minor
---

Added `--kind postgres` to `mastra env db create` for provisioning a VPC-isolated Postgres database on Mastra Cloud. The `mastra deploy` auto-provision prompt now offers a choice between Neon (public serverless) and Postgres (VPC-isolated) when both providers are enabled for your organization and `DATABASE_URL` is missing.

Before, the prompt could only offer to provision Neon:

```
? Preflight needs DATABASE_URL for the production environment. Create a managed neon database now and attach it? (Y/n)
```

Now:

```
? Preflight needs DATABASE_URL for the production environment. Which managed database should be provisioned?
  ❯ Neon (serverless, public)
    Postgres (VPC-isolated)
    Skip — set it manually later
```
