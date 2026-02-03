The plan is change the docs copy functionality of the @mastra/mcp-docs-server package. Not using the raw MDX files but instead use the generated llms.txt files from the docs output.

## Relevant locations

- Current docs: docs/
- Current MCP Docs Server: packages/mcp-docs-server/
- Manifest file: docs/build/llms-manifest.json
- Location of new file that should have the functionality: packages/mcp-docs-server/scripts/prepare-docs.ts

## llms.txt files

The docs generate during `npm run build` individual llms.txt files in the `build` folder. These files contain the processed documentation in a format suitable for LLMs. Each page has such a file, e.g. `docs/build/docs/agents/agent-approval/llms.txt`.

This ONLY happens during `npm run build` and not during `npm run dev` for the docs.

The docs/build/llms-manifest.json contains a mapping of which llms.txt files belong to which package.

## PLAN

1. Use the manifest file to create a copy of the docs/build output structure inside the `.docs` folder of the mcp-docs-server package. So for each entry in the manifest, copy the corresponding llms.txt file to `.docs/<path-from-manifest>/llms.txt`.
2. Update packages/mcp-docs-server/src/tools/docs.ts to understand this new structure (and read from `.docs/` instead of `.docs/raw`)
