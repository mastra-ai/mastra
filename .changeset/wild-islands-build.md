---
'@mastra/core': patch
---

Fixed agents with channels failing on Cloudflare Workers with `No such module "chat"`.

The channels feature loads the Chat SDK (the `chat` package) through a dynamic import whose module name was hidden in a variable. That hid the dependency from bundlers, so serverless deploy targets that must bundle everything at build time (like Cloudflare Workers via `@mastra/deployer-cloudflare`) never included `chat` — channels then failed to initialize at runtime, and Slack/Discord/Telegram webhooks returned errors. The dependency was also missing from the generated deploy `package.json`, so Node deploy outputs required a manual `bundler.dynamicPackages: ['chat']` workaround.

The import now uses a literal specifier (`import('chat')`), so bundlers can see and include the package. No configuration changes or workarounds are needed anymore — deploys that use channels work out of the box. The import stays lazy, so projects that don't use channels don't load the Chat SDK. A build-time check now guards against the CJS output ever regressing to `require('chat')`, which would break CommonJS consumers since `chat` is ESM-only.

Fixes #19254
