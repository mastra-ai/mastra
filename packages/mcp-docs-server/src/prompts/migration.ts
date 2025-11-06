import type { MCPServerPrompts } from '@mastra/mcp';
import type { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * Migration prompts provide guided workflows for upgrading Mastra versions.
 * These prompts help users systematically work through breaking changes.
 */
const migrationPrompts: Prompt[] = [
  {
    name: 'upgrade-to-v1',
    version: 'v1',
    description:
      'Get a guided migration plan for upgrading from Mastra v0.x to v1.0. Provides step-by-step instructions for handling all breaking changes.',
    arguments: [
      {
        name: 'area',
        description:
          'Optional: Focus on a specific area (agents, tools, workflows, memory, evals, mcp, vectors, syncs). If not provided, gives an overview of all changes.',
        required: false,
      },
    ],
  },
  {
    name: 'migration-checklist',
    version: 'v1',
    description:
      'Get a comprehensive checklist for migrating to Mastra v1.0. Lists all breaking changes that need to be addressed.',
  },
];

/**
 * Prompt messages callback that generates contextual migration guidance
 */
export const migrationPromptMessages: MCPServerPrompts = {
  listPrompts: async () => migrationPrompts,

  getPromptMessages: async ({ name, args }): Promise<PromptMessage[]> => {
    const prompt = migrationPrompts.find(p => p.name === name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    if (name === 'upgrade-to-v1') {
      return getUpgradeToV1Messages(args?.area);
    }

    if (name === 'migration-checklist') {
      return getMigrationChecklistMessages();
    }

    throw new Error(`No message handler for prompt: ${name}`);
  },
};

/**
 * Generate messages for the upgrade-to-v1 prompt
 */
function getUpgradeToV1Messages(area?: string): PromptMessage[] {
  if (area) {
    const validAreas = ['agents', 'tools', 'workflows', 'memory', 'evals', 'mcp', 'vectors', 'syncs'];
    if (!validAreas.includes(area.toLowerCase())) {
      return [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Invalid area: ${area}. Valid areas are: ${validAreas.join(', ')}`,
          },
        },
      ];
    }

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I need help migrating my Mastra ${area} code from v0.x to v1.0. Use the mastraMigration tool to get the specific migration guide for "${area}" and walk me through the changes step by step.`,
        },
      },
    ];
  }

  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `I need to migrate my Mastra project from v0.x to v1.0. Use the mastraMigration tool to:

1. First, list all available migration guides with path: "upgrade-to-v1/"
2. Give me a high-level overview of what changed in each area
3. Ask me which areas I'm using in my project so we can focus on relevant changes
4. After I decided on the areas, check the migration guides for callouts to codemods. These callouts are marked with ":::tip[Codemod]" in the docs. Run the codemods with "npx @mastra/codemod@beta v1" to automate all those changes. Afterwards, help me with any remaining manual changes needed.

After I tell you which areas I use, we'll go through each one systematically.`,
      },
    },
  ];
}

/**
 * Generate messages for the migration-checklist prompt
 */
function getMigrationChecklistMessages(): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a comprehensive migration checklist for upgrading from Mastra v0.x to v1.0. Use the mastraMigration tool to:

1. List all available migration guides (path: "upgrade-to-v1/")
2. For each guide, extract the key breaking changes
3. Present them as a checklist I can work through

Format the checklist with:
- [ ] checkbox items for each breaking change
- Brief description of what needs to change
- Reference to the specific migration guide

Group the checklist by area (Agents, Tools, Workflows, etc.) so I can tackle one area at a time.`,
      },
    },
  ];
}
