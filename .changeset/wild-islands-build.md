---
'@mastra/core': patch
---

Fixed agents with channels failing on Cloudflare Workers with `No such module "chat"`.

Agents with Slack, Discord, or Telegram channels now deploy to Cloudflare Workers and other serverless targets without extra configuration — channels initialize correctly and webhooks work out of the box. The `bundler.dynamicPackages: ['chat']` workaround is no longer needed for Node deploys. Projects that don't use channels still load the Chat SDK lazily.

Fixes #19254
