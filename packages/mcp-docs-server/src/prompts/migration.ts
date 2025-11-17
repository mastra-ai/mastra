import type { MCPServerPrompts } from '@mastra/mcp';
import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

const UPGRADE_MESSAGE = `# Migration Guide Upgrade Required

To access migration guides for upgrading to Mastra v1.0-beta, you need to upgrade your mcp-docs-server to the beta version.

## How to Upgrade

The migration tool and prompts are only available in the beta version of the mcp-docs-server.

Visit the installation guide for detailed instructions on how to upgrade to the beta version:

https://mastra.ai/docs/v1/getting-started/mcp-docs-server#installation

Once upgraded, you'll be able to:
- Browse migration guides with the \`mastraMigration\` tool
- Use migration prompts like \`upgrade-to-v1\` and \`migration-checklist\`
- Get step-by-step migration instructions for each breaking change
- Use automated codemods to handle many migrations automatically

## Why Beta?

The migration guides are specific to the v1.0-beta release and are actively being updated as the beta evolves. The stable (0.x) documentation server doesn't include these guides as they're not relevant to users on the stable version.

---

**Note:** This message is shown because you're currently using the stable (@latest) version of @mastra/mcp-docs-server. Upgrade to @beta to access migration guides and prompts.`;

const migrationPrompts: Prompt[] = [
  {
    name: 'upgrade-to-v1',
    description:
      'Get a guided migration plan for upgrading from Mastra v0.x to v1.0-beta. Optionally specify an area (e.g., "agent", "workflow") to focus on.',
    arguments: [
      {
        name: 'area',
        description:
          'Optional: A specific area to focus the migration guide on (e.g., "agent", "workflow", "tools")',
        required: false,
      },
    ],
  },
  {
    name: 'migration-checklist',
    description:
      'Get a comprehensive checklist for migrating to Mastra v1.0-beta. Lists all breaking changes organized by area.',
  },
];

export const migrationPromptMessages: MCPServerPrompts = {
  listPrompts: async () => migrationPrompts,
  getPromptMessages: async ({ name }): Promise<PromptMessage[]> => {
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
