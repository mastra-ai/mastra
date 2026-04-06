import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { WORKSPACE_TOOLS } from '../constants';
import { emitWorkspaceMetadata, requireFilesystem } from './helpers';
import { applyTokenLimit } from './output-helpers';
import { startWorkspaceSpan } from './tracing';
import { formatAsTree } from './tree-formatter';

export const listFilesTool = createTool({
  id: WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES,
  description: `List files and directories in the workspace filesystem.
Returns a compact tab-indented listing for efficient token usage.
Options mirror common tree command flags for familiarity.

Examples:
- List workspace root: { path: "." }
- Deep listing: { path: "src", maxDepth: 5 }
- Directories only: { path: ".", dirsOnly: true }
- Exclude node_modules: { path: ".", exclude: "node_modules" }
- Find TypeScript files: { path: "src", pattern: "**/*.ts" }
- Find config files: { path: ".", pattern: "*.config.{js,ts}" }
- Multiple patterns: { path: ".", pattern: ["**/*.ts", "**/*.tsx"] }

To list ALL files, omit the pattern parameter — do NOT pass pattern: "*".`,
  inputSchema: z.object({
    path: z.string().default('.').describe('Directory path to list'),
    maxDepth: z
      .number()
      .optional()
      .default(2)
      .describe('Maximum depth to descend (default: 2). Similar to tree -L flag.'),
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
        'Glob pattern(s) to filter files. Omit this parameter to list all files (do NOT pass "*"). Use "**/*.ext" to match files recursively across directories. "*" only matches within a single directory level (standard glob). Glob patterns only filter files — directories are always shown to preserve tree structure. Examples: "**/*.ts", "src/**/*.test.ts", "*.config.{js,ts}".',
      ),
    respectGitignore: z
      .boolean()
      .optional()
      .default(true)
      .describe('Respect .gitignore in the listed directory (default: true).'),
  }),
  execute: async (
    { path = '.', maxDepth = 2, showHidden, dirsOnly, exclude, extension, pattern, respectGitignore },
    context,
  ) => {
    const { workspace, filesystem } = requireFilesystem(context);
    await emitWorkspaceMetadata(context, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);

    const span = startWorkspaceSpan(context, workspace, {
      category: 'filesystem',
      operation: 'listFiles',
      input: { path, maxDepth, pattern },
      attributes: { filesystemProvider: filesystem.provider },
    });

    try {
      const result = await formatAsTree(filesystem, path, {
        maxDepth,
        showHidden,
        dirsOnly,
        exclude: exclude || undefined,
        extension: extension || undefined,
        pattern: pattern || undefined,
        respectGitignore,
      });

      const output = await applyTokenLimit(
        `${result.tree}\n\n${result.summary}`,
        workspace.getToolsConfig()?.[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES]?.maxOutputTokens ?? 1_000,
        'end',
      );
      span.end({ success: true }, { resultCount: result.fileCount });
      return output;
    } catch (err) {
      span.error(err);
      throw err;
    }
  },
});
