---
'mastra': minor
'@mastra/deployer': minor
---

Added deploy-scoped worker provisioning for Mastra Cloud. Deployment builds now use static analysis to emit a nullable, versioned `workers.json` manifest when a Mastra instance explicitly configures shared storage and PubSub. The manifest describes orchestration, scheduler, background task, and statically discoverable custom workers, and `mastra deploy` uses it to coordinate dedicated worker services behind the `platform-workers` rollout flag. Worker runtimes also expose an authenticated configuration endpoint so Mastra Cloud can compare the live topology with the build-time manifest.

Deploy preflight now detects missing or localhost database URLs, offers to attach managed Redis when interactive, and prints the exact command required for non-interactive runs. New environments prompt for a United States or Europe deployment region unless `--region` or `--yes` is provided. Deploy output also includes a colored architecture summary for Studio, server, workers, databases, observability, and region.
