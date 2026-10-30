---
'mastra': patch
'@mastra/deployer': patch
---

`mastra dev` and `mastra start` now run the server with Node's `--enable-source-maps` flag when `bundler.sourcemap` is enabled, so stack traces point at your source files instead of `.mastra/output/index.mjs`. A `--enable-source-maps` or `--no-enable-source-maps` setting in `NODE_OPTIONS` or `--custom-args` takes precedence. See [#29048](https://github.com/mastra-ai/mastra/issues/29048).
