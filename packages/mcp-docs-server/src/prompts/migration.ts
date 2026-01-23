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
          'Optional: Focus on a specific area (e.g., agent, tools, workflows, memory, storage, voice). The tool will check if a migration guide exists for this area and suggest alternatives if not found. If not provided, gives an overview of all changes.',
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
    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `I need help migrating my Mastra ${area} code from v0.x to v1.0. Use the mastraMigration tool to:

1. If packages aren't already at the 'beta' tag, upgrade packages to the 'beta' tag and do an install of the new packages.
2. First, try to get the specific migration guide for "${area}" using path: "upgrade-to-v1/${area}"
3. If that doesn't exist, try the alternate form (singular/plural):
   - If "${area}" ends with 's', try without the 's' (e.g., "agents" → "agent")
   - If "${area}" doesn't end with 's', try adding 's' (e.g., "agent" → "agents")
4. If the guide exists, walk me through the changes step by step
5. If neither form exists, list available migration guides in "upgrade-to-v1/" and suggest which ones might be relevant to "${area}"
6. After you find the guide, collect all the codemod calls to run to codemods. These callouts are marked with ":::tip[Codemod]" in the docs. Run the codemods with "npx @mastra/codemod@latest <codemod-name> <path>" to automate all those changes. Afterwards, help me with any remaining manual changes needed.`,
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

1. If packages aren't already at the 'beta' tag, upgrade packages to the 'beta' tag and do an install of the new packages.
2. First, list all available migration guides with path: "upgrade-to-v1/"
2. Give me a high-level overview of what changed in each area
3. Find relevant migration areas to focus on based on my project's codebase and confirm the list with me
4. After the areas are confirmed, check the migration guides for callouts to codemods. These callouts are marked with ":::tip[Codemod]" in the docs. Run the codemods with "npx @mastra/codemod@latest v1" to automate all those changes. Afterwards, help me with any remaining manual changes needed.

After the areas are confirmed, we'll go through each one systematically.`,
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
