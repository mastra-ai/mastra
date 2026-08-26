---
'mastra': minor
'@mastra/deployer': minor
---

Added deploy-scoped background worker provisioning for Mastra Cloud. Deployment builds now emit a nullable `workers.json` manifest from statically detected background task configuration, and `mastra deploy` uses it to coordinate dedicated worker services behind the `platform-workers` rollout flag.

Deploy preflight now detects missing or localhost database URLs, offers to attach managed Redis when interactive, and prints the exact command required for non-interactive runs. New environments prompt for a United States or Europe deployment region unless `--region` or `--yes` is provided. Deploy output also includes a colored architecture summary for Studio, server, workers, databases, observability, and region.
