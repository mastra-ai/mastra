---
'@mastra/auth-studio': patch
---

Fixed local dev auth: MastraAuthStudio now falls back to organizationId in .mastra-project.json when neither the constructor option nor MASTRA_ORGANIZATION_ID env var is set. Running pnpm mastra dev in a project linked to a platform organization now pins AuthKit to that org and skips the WorkOS org picker for multi-org users, without requiring the env var to be exported locally.
