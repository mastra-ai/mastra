# @mastra/code-sdk

## 0.1.0-alpha.0

### Minor Changes

- Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output. ([#18986](https://github.com/mastra-ai/mastra/pull/18986))

### Patch Changes

- Removed invalid CommonJS export entries from @mastra/code-sdk so package resolution matches the published ESM output. ([#19127](https://github.com/mastra-ai/mastra/pull/19127))

- Updated dependencies [[`6789ab4`](https://github.com/mastra-ai/mastra/commit/6789ab4191ddcd32a932898b360b191e80cee1a9)]:
  - @mastra/schema-compat@1.3.4-alpha.0
  - @mastra/core@1.50.2-alpha.1
  - @mastra/mcp@1.13.1
  - @mastra/memory@1.22.3-alpha.0
