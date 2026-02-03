The plan is to simplify the @mastra/mcp-docs-server package. It should be more focused on serving documentation files and information. It also should use a new way of getting its docs, not using the raw MDX files but instead use the generated llms.txt files from the docs output.

## Relevant locations

- Current docs: docs/
- Current MCP Docs Server: packages/mcp-docs-server/

## llms.txt files

The docs generate during `npm run build` individual llms.txt files in the `build` folder. These files contain the processed documentation in a format suitable for LLMs. Each page has such a file, e.g. `docs/build/docs/agents/agent-approval/llms.txt`.

This ONLY happens during `npm run build` and not during `npm run dev` for the docs.

## PLAN

1. Modify docs/src/plugins/docusaurus-plugin-llms-txt to generate a `llms-manifest.json` file in the `build` folder. Most of the docs files (e.g. `docs/src/content/en/docs/agents/agent-approval.mdx`) contain a `packages` entry in the frontmatter. An example of that fronmttater:

```yaml
packages:
  - '@mastra/core'
  - '@mastra/libsql'
  - '@mastra/memory'
```

The manifest file should map each package to the list of llms.txt files that belong to that package. It should follow this structure:

```json
{
  "@mastra/core": [
    {
      "path": "docs/agents/agent-approval/llms.txt",
      "title": "Agent Approval",
      "category": "docs",
      "folderPath": "agents/agent-approval"
    },
    {
      "path": "docs/observability/tracing/exporters/arize/llms.txt",
      "title": "Arize Exporter",
      "category": "docs",
      "folderPath": "observability/tracing/exporters"
    }
  ],
  "@mastra/client-js": [
    {
      "path": "reference/client-js/agents/llms.txt",
      "title": "Agents API",
      "category": "reference",
      "folderPath": "client-js/agents"
    }
  ]
}
```

2. Modify the @mastra/mcp-docs-server package so that before it's being built, it builds the docs and reads the generated `llms-manifest.json` file.
3. The @mastra/mcp-docs-server package currently copies the raw MDX files from the docs (packages/mcp-docs-server/src/prepare-docs/copy-raw.ts). This should be removed.
4. Instead, the MCP Docs Server should read the `llms-manifest.json` file and copy the llms.txt files over (while maintaining the folder structure) into its own `.docs` folder.
