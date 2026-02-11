---
'@mastra/deployer-cloudflare': minor
---

Write `wrangler.jsonc` file to the root of your project. Up until now, the deployer created a `.mastra/output/wrangler.json` file that you had to point the `wrangler` CLI and builds to.

For backwards-compatibility the deployer will still create the `.mastra/output/wrangler.json` file until the next major release. We encourage you to use the root `wrangler.jsonc` file instead.

By writing `wrangler.jsonc` directly to the root you can use the `wrangler` CLI without any `--config` flag and deployments (e.g. through GitHub) will also automatically pick up the `wrangler.jsonc` file without any extra configuration.
