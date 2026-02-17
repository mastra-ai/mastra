import { z } from 'zod';
import { createTool } from '@mastra/core/tools';
import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
import { requireFilesystem } from './helpers';
import { formatAsTree } from './tree-formatter';

export const listFilesTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
  description: `List files and directories in the workspace filesystem.
Returns a tree-style view (like the Unix "tree" command) for easy visualization.
The output is displayed to the user as a tree-like structure in the tool result.
Options mirror common tree command flags for familiarity.

Examples:
- List root: { path: "/" }
- Deep listing: { path: "/src", maxDepth: 5 }
- Directories only: { path: "/", dirsOnly: true }
- Exclude node_modules: { path: "/", exclude: "node_modules" }
- Find TypeScript files: { path: "/src", pattern: "**/*.ts" }
- Find config files: { path: "/", pattern: "*.config.{js,ts}" }
- Multiple patterns: { path: "/", pattern: ["**/*.ts", "**/*.tsx"] }`,
  inputSchema: z.object({
    path: z.string().default('/').describe('Directory path to list'),
    maxDepth: z
      .number()
      .optional()
      .default(3)
      .describe('Maximum depth to descend (default: 3). Similar to tree -L flag.'),
    showHidden: z
      .boolean()
      .optional()
      .default(false)
      .describe('Show hidden files starting with "." (default: false). Similar to tree -a flag.'),
    dirsOnly: z
      .boolean()
      .optional()
      .default(false)
      .describe('List directories only, no files (default: false). Similar to tree -d flag.'),
    exclude: z.string().optional().describe('Pattern to exclude (e.g., "node_modules"). Similar to tree -I flag.'),
    extension: z.string().optional().describe('Filter by file extension (e.g., ".ts"). Similar to tree -P flag.'),
    pattern: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        'Glob pattern(s) to filter files. Examples: "**/*.ts", "src/**/*.test.ts", "*.config.{js,ts}". Directories always pass through.',
      ),
  }),
  execute: async ({ path = '/', maxDepth = 3, showHidden, dirsOnly, exclude, extension, pattern }, context) => {
    const { workspace, filesystem } = requireFilesystem(context);

    const result = await formatAsTree(filesystem, path, {
      maxDepth,
      showHidden,
      dirsOnly,
      exclude: exclude || undefined,
      extension: extension || undefined,
      pattern: pattern || undefined,
    });

    await context?.writer?.custom({
      type: 'data-workspace-metadata',
      data: {
        toolName: WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
        path,
        summary: result.summary,
        workspace: { id: workspace.id, name: workspace.name },
        filesystem: { id: filesystem.id, name: filesystem.name, provider: filesystem.provider },
      },
    });

    return `${result.tree}\n\n${result.summary}`;
  },
});
