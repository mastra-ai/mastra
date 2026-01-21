/**
 * Workspace Tools
 *
 * Auto-injected tools for agents with workspace configured.
 * These tools provide filesystem and sandbox capabilities.
 */

import { z } from 'zod';
import { createTool } from '../tools';
import type { Workspace } from './workspace';

/**
 * Creates workspace tools that will be auto-injected into agents.
 *
 * @param workspace - The workspace instance to bind tools to
 * @returns Record of workspace tools
 */
export function createWorkspaceTools(workspace: Workspace) {
  const tools: Record<string, any> = {};
  const safetyConfig = workspace.getSafetyConfig();
  const isReadOnly = safetyConfig?.readOnly ?? false;
  const sandboxApproval = safetyConfig?.requireSandboxApproval ?? 'none';
  const fsApproval = safetyConfig?.requireFilesystemApproval ?? 'none';

  // Only add filesystem tools if filesystem is available
  if (workspace.filesystem) {
    // Read tools are always available
    tools.workspace_read_file = createTool({
      id: 'workspace_read_file',
      description: 'Read the contents of a file from the workspace filesystem',
      // Require approval when fsApproval is 'all'
      requireApproval: fsApproval === 'all',
      inputSchema: z.object({
        path: z.string().describe('The path to the file to read (e.g., "/data/config.json")'),
        encoding: z
          .enum(['utf-8', 'utf8', 'base64', 'hex', 'binary'])
          .optional()
          .describe('The encoding to use when reading the file. Defaults to utf-8 for text files.'),
      }),
      outputSchema: z.object({
        content: z.string().describe('The file contents'),
        size: z.number().describe('The file size in bytes'),
        path: z.string().describe('The full path to the file'),
      }),
      execute: async ({ path, encoding }) => {
        const content = await workspace.readFile(path, {
          encoding: (encoding as BufferEncoding) ?? 'utf-8',
        });
        const stat = await workspace.filesystem!.stat(path);
        return {
          content: typeof content === 'string' ? content : content.toString('base64'),
          size: stat.size,
          path: stat.path,
        };
      },
    });

    // Write tools are only available if not in readonly mode
    if (!isReadOnly) {
      tools.workspace_write_file = createTool({
        id: 'workspace_write_file',
        description: 'Write content to a file in the workspace filesystem. Creates parent directories if needed.',
        // Require approval when fsApproval is 'all' or 'write'
        requireApproval: fsApproval === 'all' || fsApproval === 'write',
        inputSchema: z.object({
          path: z.string().describe('The path where to write the file (e.g., "/data/output.txt")'),
          content: z.string().describe('The content to write to the file'),
          overwrite: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to overwrite the file if it already exists'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string().describe('The path where the file was written'),
          size: z.number().describe('The size of the written content in bytes'),
        }),
        execute: async ({ path, content, overwrite }) => {
          await workspace.writeFile(path, content, { overwrite });
          return {
            success: true,
            path,
            size: Buffer.byteLength(content, 'utf-8'),
          };
        },
      });
    }

    tools.workspace_list_files = createTool({
      id: 'workspace_list_files',
      description: 'List files and directories in the workspace filesystem',
      // Require approval when fsApproval is 'all'
      requireApproval: fsApproval === 'all',
      inputSchema: z.object({
        path: z.string().default('/').describe('The directory path to list (e.g., "/" or "/data")'),
        recursive: z.boolean().optional().default(false).describe('Whether to list files recursively'),
        extension: z.string().optional().describe('Filter by file extension (e.g., ".json", ".txt")'),
      }),
      outputSchema: z.object({
        entries: z.array(
          z.object({
            name: z.string().describe('File or directory name'),
            type: z.enum(['file', 'directory']).describe('Whether this is a file or directory'),
            size: z.number().optional().describe('File size in bytes (only for files)'),
          }),
        ),
        path: z.string().describe('The directory that was listed'),
        count: z.number().describe('Total number of entries'),
      }),
      execute: async ({ path = '/', recursive, extension }) => {
        const entries = await workspace.readdir(path, {
          recursive,
          extension: extension ? [extension] : undefined,
        });
        return {
          entries: entries.map(e => ({
            name: e.name,
            type: e.type,
            size: e.size,
          })),
          path,
          count: entries.length,
        };
      },
    });

    // Delete file is a write operation
    if (!isReadOnly) {
      tools.workspace_delete_file = createTool({
        id: 'workspace_delete_file',
        description: 'Delete a file from the workspace filesystem',
        // Require approval when fsApproval is 'all' or 'write'
        requireApproval: fsApproval === 'all' || fsApproval === 'write',
        inputSchema: z.object({
          path: z.string().describe('The path to the file to delete'),
          force: z.boolean().optional().default(false).describe('Whether to ignore errors if the file does not exist'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string(),
        }),
        execute: async ({ path, force }) => {
          await workspace.filesystem!.deleteFile(path, { force });
          return { success: true, path };
        },
      });
    }

    tools.workspace_file_exists = createTool({
      id: 'workspace_file_exists',
      description: 'Check if a file or directory exists in the workspace',
      // Require approval when fsApproval is 'all'
      requireApproval: fsApproval === 'all',
      inputSchema: z.object({
        path: z.string().describe('The path to check'),
      }),
      outputSchema: z.object({
        exists: z.boolean().describe('Whether the path exists'),
        type: z.enum(['file', 'directory', 'none']).describe('The type of the path if it exists'),
      }),
      execute: async ({ path }) => {
        const exists = await workspace.exists(path);
        if (!exists) {
          return { exists: false, type: 'none' as const };
        }
        const isFile = await workspace.filesystem!.isFile(path);
        return {
          exists: true,
          type: isFile ? ('file' as const) : ('directory' as const),
        };
      },
    });

    // mkdir is a write operation
    if (!isReadOnly) {
      tools.workspace_mkdir = createTool({
        id: 'workspace_mkdir',
        description: 'Create a directory in the workspace filesystem',
        // Require approval when fsApproval is 'all' or 'write'
        requireApproval: fsApproval === 'all' || fsApproval === 'write',
        inputSchema: z.object({
          path: z.string().describe('The path of the directory to create'),
          recursive: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to create parent directories if they do not exist'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string(),
        }),
        execute: async ({ path, recursive }) => {
          await workspace.filesystem!.mkdir(path, { recursive });
          return { success: true, path };
        },
      });
    }
  }

  // Only add search tools if search is available
  if (workspace.canBM25 || workspace.canVector) {
    tools.workspace_search = createTool({
      id: 'workspace_search',
      description:
        'Search indexed content in the workspace. Supports keyword (BM25), semantic (vector), and hybrid search modes.',
      // Require approval when fsApproval is 'all'
      requireApproval: fsApproval === 'all',
      inputSchema: z.object({
        query: z.string().describe('The search query string'),
        topK: z.number().optional().default(5).describe('Maximum number of results to return'),
        mode: z
          .enum(['bm25', 'vector', 'hybrid'])
          .optional()
          .describe('Search mode: bm25 for keyword search, vector for semantic search, hybrid for both combined'),
        minScore: z.number().optional().describe('Minimum score threshold (0-1 for normalized scores)'),
      }),
      outputSchema: z.object({
        results: z.array(
          z.object({
            id: z.string().describe('Document/file path'),
            content: z.string().describe('The matching content'),
            score: z.number().describe('Relevance score'),
            lineRange: z
              .object({
                start: z.number(),
                end: z.number(),
              })
              .optional()
              .describe('Line range where query terms were found'),
          }),
        ),
        count: z.number().describe('Number of results returned'),
        mode: z.string().describe('The search mode that was used'),
      }),
      execute: async ({ query, topK, mode, minScore }) => {
        const results = await workspace.search(query, {
          topK,
          mode: mode as 'bm25' | 'vector' | 'hybrid' | undefined,
          minScore,
        });
        return {
          results: results.map(r => ({
            id: r.id,
            content: r.content,
            score: r.score,
            lineRange: r.lineRange,
          })),
          count: results.length,
          mode: mode ?? (workspace.canHybrid ? 'hybrid' : workspace.canVector ? 'vector' : 'bm25'),
        };
      },
    });

    // Index is a write operation (to the search index)
    if (!isReadOnly) {
      tools.workspace_index = createTool({
        id: 'workspace_index',
        description: 'Index content for search. The path becomes the document ID in search results.',
        // Require approval when fsApproval is 'all' or 'write'
        requireApproval: fsApproval === 'all' || fsApproval === 'write',
        inputSchema: z.object({
          path: z.string().describe('The document ID/path for search results'),
          content: z.string().describe('The text content to index'),
          metadata: z.record(z.unknown()).optional().describe('Optional metadata to store with the document'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string().describe('The indexed document ID'),
        }),
        execute: async ({ path, content, metadata }) => {
          await workspace.index(path, content, { metadata });
          return { success: true, path };
        },
      });
    }
  }

  // Only add sandbox tools if sandbox is available
  if (workspace.sandbox) {
    // Get path context for dynamic descriptions
    const pathContext = workspace.getPathContext();

    // Build path context description for sandbox tools
    let pathInfo = '';
    if (pathContext.type === 'same-context' && pathContext.filesystem?.basePath) {
      pathInfo = ` Workspace filesystem basePath: "${pathContext.filesystem.basePath}" (files at workspace path "/foo" are at "${pathContext.filesystem.basePath}/foo" on disk).`;
      if (pathContext.sandbox?.workingDirectory) {
        pathInfo += ` Working directory (process.cwd()): "${pathContext.sandbox.workingDirectory}".`;
      }
      if (pathContext.sandbox?.scriptDirectory) {
        pathInfo += ` Script directory (__dirname): "${pathContext.sandbox.scriptDirectory}".`;
      }
    } else if (pathContext.type === 'cross-context') {
      pathInfo =
        ' Filesystem and sandbox are in different environments. Read file contents using workspace_read_file and pass them as variables to your code.';
    } else if (pathContext.type === 'sandbox-only') {
      if (pathContext.sandbox?.workingDirectory) {
        pathInfo = ` Working directory: "${pathContext.sandbox.workingDirectory}".`;
      }
    }

    tools.workspace_execute_code = createTool({
      id: 'workspace_execute_code',
      description: `Execute code in the workspace sandbox. Supports multiple runtimes including Node.js, Python, and shell.${pathInfo}`,
      // Require approval when sandboxApproval is 'all'
      requireApproval: sandboxApproval === 'all',
      inputSchema: z.object({
        code: z.string().describe('The code to execute'),
        runtime: z
          .enum(['node', 'python', 'bash', 'shell', 'ruby'])
          .nullish()
          .default('node')
          .describe('The runtime to use for execution'),
        timeout: z
          .number()
          .nullish()
          .default(30000)
          .describe(
            'Maximum execution time in milliseconds. Default is 30000 (30 seconds). Example: 60000 for 1 minute.',
          ),
      }),
      outputSchema: z.object({
        success: z.boolean().describe('Whether the code executed successfully (exit code 0)'),
        stdout: z.string().describe('Standard output from the execution'),
        stderr: z.string().describe('Standard error output'),
        exitCode: z.number().describe('Exit code (0 = success)'),
        executionTimeMs: z.number().describe('How long the execution took in milliseconds'),
      }),
      execute: async ({ code, runtime, timeout }) => {
        const result = await workspace.executeCode(code, {
          runtime: runtime ?? undefined,
          timeout: timeout ?? 30000,
        });
        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs: result.executionTimeMs,
        };
      },
    });

    tools.workspace_execute_command = createTool({
      id: 'workspace_execute_command',
      description: `Execute a shell command in the workspace sandbox.${pathInfo}`,
      // Require approval when sandboxApproval is 'all' or 'commands'
      requireApproval: sandboxApproval === 'all' || sandboxApproval === 'commands',
      inputSchema: z.object({
        command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
        args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
        timeout: z
          .number()
          .nullish()
          .default(30000)
          .describe(
            'Maximum execution time in milliseconds. Default is 30000 (30 seconds). Example: 60000 for 1 minute.',
          ),
        cwd: z.string().nullish().describe('Working directory for the command'),
      }),
      outputSchema: z.object({
        success: z.boolean().describe('Whether the command executed successfully (exit code 0)'),
        stdout: z.string().describe('Standard output from the command'),
        stderr: z.string().describe('Standard error output'),
        exitCode: z.number().describe('Exit code (0 = success)'),
        executionTimeMs: z.number().describe('How long the execution took in milliseconds'),
      }),
      execute: async ({ command, args, timeout, cwd }) => {
        const result = await workspace.executeCommand(command, args ?? [], {
          timeout: timeout ?? 30000,
          cwd: cwd ?? undefined,
        });
        return {
          success: result.success,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs: result.executionTimeMs,
        };
      },
    });

    tools.workspace_install_package = createTool({
      id: 'workspace_install_package',
      description: 'Install a package in the workspace sandbox environment',
      // Require approval when sandboxApproval is 'all' or 'commands'
      requireApproval: sandboxApproval === 'all' || sandboxApproval === 'commands',
      inputSchema: z.object({
        packageName: z.string().describe('The name of the package to install'),
        packageManager: z
          .enum(['npm', 'pip', 'yarn', 'pnpm'])
          .optional()
          .default('npm')
          .describe('The package manager to use'),
        version: z.string().optional().describe('Specific version to install'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        packageName: z.string(),
        version: z.string().optional(),
        errorMessage: z.string().optional(),
        executionTimeMs: z.number(),
      }),
      execute: async ({ packageName, packageManager, version }) => {
        if (!workspace.sandbox!.installPackage) {
          return {
            success: false,
            packageName,
            errorMessage: 'Package installation not supported by this sandbox',
            executionTimeMs: 0,
          };
        }
        const result = await workspace.sandbox!.installPackage(packageName, { packageManager, version });
        return {
          success: result.success,
          packageName: result.packageName,
          version: result.version,
          errorMessage: result.error,
          executionTimeMs: result.executionTimeMs,
        };
      },
    });
  }

  return tools;
}

/**
 * Tool names for workspace tools.
 */
export const WORKSPACE_TOOL_NAMES = {
  // Filesystem tools
  READ_FILE: 'workspace_read_file',
  WRITE_FILE: 'workspace_write_file',
  LIST_FILES: 'workspace_list_files',
  DELETE_FILE: 'workspace_delete_file',
  FILE_EXISTS: 'workspace_file_exists',
  MKDIR: 'workspace_mkdir',
  // Search tools
  SEARCH: 'workspace_search',
  INDEX: 'workspace_index',
  // Sandbox tools
  EXECUTE_CODE: 'workspace_execute_code',
  EXECUTE_COMMAND: 'workspace_execute_command',
  INSTALL_PACKAGE: 'workspace_install_package',
} as const;
