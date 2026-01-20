import { z } from 'zod';
import { logger } from '../logger';

export const migrationInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Path to the migration guide (e.g., "upgrade-to-v1/agent", "agentnetwork"). If not provided, lists all available migrations.\n\nExample migration paths:\n- agentnetwork\n- upgrade-to-v1/agent\n- upgrade-to-v1/cli\n- upgrade-to-v1/client\n- upgrade-to-v1/evals\n...',
    ),
  listSections: z
    .boolean()
    .optional()
    .describe('Set to true to list all section headers in a migration guide without fetching full content.'),
  sections: z
    .array(z.string())
    .optional()
    .describe(
      'Specific section titles to fetch from the migration guide. If not provided, returns the entire guide. Use this after exploring section headers.',
    ),
  queryKeywords: z
    .array(z.string())
    .optional()
    .describe('Keywords to search across all migration guides. Use this to find guides related to specific topics.'),
});

export type MigrationInput = z.infer<typeof migrationInputSchema>;

const UPGRADE_MESSAGE = `# Migration Guide Upgrade Required

To access migration guides for upgrading to Mastra v1, you need to upgrade your mcp-docs-server to the latest version.

## How to Upgrade

The migration tool is only available in the latest version of the mcp-docs-server.

1. **Update your MCP server configuration** to use the latest version. Visit the installation guide for detailed instructions:

   https://mastra.ai/docs/getting-started/mcp-docs-server#installation

2. **Restart your MCP server** after updating to pick up the latest version

3. **Access migration guides** - Once upgraded, you'll be able to:
   - Browse migration guides with the \`mastraMigration\` tool
   - Get step-by-step migration instructions for each breaking change
   - Use automated codemods to handle many migrations automatically

## Need Help?

If you have questions about upgrading:
- Check the Mastra documentation at https://mastra.ai/docs
- Visit the GitHub repository for issues and discussions
- Join the Mastra community for support

---

**Note:** This message is shown because you're currently using the 0.x version of @mastra/mcp-docs-server. Upgrade to @latest to access migration guides.`;

export const migrationTool = {
  name: 'mastraMigration',
  description: `Get migration guidance for Mastra version upgrades and breaking changes.

This tool works like a file browser - navigate through directories to find migration guides:

**Step 1: List top-level migrations**
- Call with no parameters: \`{}\`
- Shows all top-level migration guides and directories

**Step 2: Navigate into a directory**
- Add trailing slash to explore: \`{ path: "upgrade-to-v1/" }\`
- Lists all migration guides in that directory

**Step 3: View a migration guide**
- Without trailing slash: \`{ path: "upgrade-to-v1/agent" }\`
- Returns the full migration guide content

**Step 4: Explore guide sections (optional)**
- List sections: \`{ path: "upgrade-to-v1/agent", listSections: true }\`
- Get specific sections: \`{ path: "upgrade-to-v1/agent", sections: ["Voice methods"] }\`

**Alternative: Search by keywords**
- \`{ queryKeywords: ["RuntimeContext", "pagination"] }\`

**Examples:**
1. List top-level: \`{}\`
2. Navigate to upgrade-to-v1: \`{ path: "upgrade-to-v1/" }\`
3. Get agent guide: \`{ path: "upgrade-to-v1/agent" }\`
4. List guide sections: \`{ path: "upgrade-to-v1/agent", listSections: true }\`
5. Search: \`{ queryKeywords: ["RuntimeContext"] }\`

**Tip:** Paths ending with \`/\` list directory contents. Paths without \`/\` fetch the migration guide.`,
  parameters: migrationInputSchema,
  execute: async (args: MigrationInput) => {
    void logger.debug('Executing mastraMigration tool (stub version)', { args });
    try {
      // Always return the upgrade message regardless of the input
      return UPGRADE_MESSAGE;
    } catch (error) {
      void logger.error('Failed to execute mastraMigration tool', error);
      throw error;
    }
  },
};
