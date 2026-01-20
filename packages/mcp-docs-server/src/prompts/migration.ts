import type { MCPServerPrompts } from '@mastra/mcp';
import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

const UPGRADE_MESSAGE = `# Migration Guide Upgrade Required

To access migration guides for upgrading to Mastra v1, you need to upgrade your mcp-docs-server to the latest version.

## How to Upgrade

The migration tool and prompts are only available in the latest version of the mcp-docs-server.

Visit the installation guide for detailed instructions on how to upgrade to the latest version:

https://mastra.ai/docs/getting-started/mcp-docs-server#installation

Once upgraded, you'll be able to:
- Browse migration guides with the \`mastraMigration\` tool
- Use migration prompts like \`upgrade-to-v1\` and \`migration-checklist\`
- Get step-by-step migration instructions for each breaking change
- Use automated codemods to handle many migrations automatically

---

**Note:** This message is shown because you're currently using the 0.x version of @mastra/mcp-docs-server. Upgrade to @latest to access migration guides and prompts.`;

const migrationPrompts: Prompt[] = [
  {
    name: 'upgrade-to-v1',
    description:
      'Get a guided migration plan for upgrading from Mastra v0.x to v1. Optionally specify an area (e.g., "agent", "workflow") to focus on.',
    arguments: [
      {
        name: 'area',
        description: 'Optional: A specific area to focus the migration guide on (e.g., "agent", "workflow", "tools")',
        required: false,
      },
    ],
  },
  {
    name: 'migration-checklist',
    description:
      'Get a comprehensive checklist for migrating to Mastra v1. Lists all breaking changes organized by area.',
  },
];

export const migrationPromptMessages: MCPServerPrompts = {
  listPrompts: async () => migrationPrompts,
  getPromptMessages: async (): Promise<PromptMessage[]> => {
    // Always return the upgrade message for any migration prompt
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: UPGRADE_MESSAGE,
        },
      },
    ];
  },
};
