---
'@mastra/deployer-cloudflare': patch
---

Fixed `Could not resolve "readable-stream"` build error when deploying to Cloudflare Workers. Dependencies like `elevenlabs` use the `readable-stream` npm package, which was marked as an external during bundling but left unresolvable by wrangler. The `readable-stream` module is now aliased to the native `node:stream` (available via `nodejs_compat`), matching the existing pattern used for `typescript` and `execa` stubs.
