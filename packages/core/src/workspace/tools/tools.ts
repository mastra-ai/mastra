/**
 * Workspace Tools
 *
 * Auto-injected tools for agents with workspace configured.
 * These tools provide filesystem and sandbox capabilities.
 */

import { z } from 'zod/v4';
import { createTool } from '../../tools';
import type { WorkspaceToolName } from '../constants';
import { WORKSPACE_TOOLS } from '../constants';
import { FileNotFoundError, FileReadRequiredError } from '../errors';
import { InMemoryFileReadTracker } from '../filesystem';
import type { FileReadTracker } from '../filesystem';
import {
  extractLinesWithLimit,
  formatWithLineNumbers,
  replaceString,
  StringNotFoundError,
  StringNotUniqueError,
} from '../line-utils';
import type { Workspace } from '../workspace';
import { formatAsTree } from './tree-formatter';
import type { WorkspaceToolsConfig } from './types';

/**
 * Resolves the effective configuration for a specific tool.
 *
 * Resolution order (later overrides earlier):
 * 1. Built-in defaults (enabled: true, requireApproval: false)
 * 2. Top-level config (tools.enabled, tools.requireApproval)
 * 3. Per-tool config (tools[toolName].enabled, tools[toolName].requireApproval)
 *
 * @param toolsConfig - The workspace tools configuration
 * @param toolName - The tool name to resolve config for
 * @returns Resolved enabled and requireApproval values
 */
export function resolveToolConfig(
  toolsConfig: WorkspaceToolsConfig | undefined,
  toolName: WorkspaceToolName,
): { enabled: boolean; requireApproval: boolean; requireReadBeforeWrite?: boolean } {
  // Built-in defaults
  let enabled = true;
  let requireApproval = false;
  let requireReadBeforeWrite: boolean | undefined;

  if (toolsConfig) {
    // Apply top-level defaults
    if (toolsConfig.enabled !== undefined) {
      enabled = toolsConfig.enabled;
    }
    if (toolsConfig.requireApproval !== undefined) {
      requireApproval = toolsConfig.requireApproval;
    }

    // Apply per-tool overrides
    const perToolConfig = toolsConfig[toolName];
    if (perToolConfig) {
      if (perToolConfig.enabled !== undefined) {
        enabled = perToolConfig.enabled;
      }
      if (perToolConfig.requireApproval !== undefined) {
        requireApproval = perToolConfig.requireApproval;
      }
      if (perToolConfig.requireReadBeforeWrite !== undefined) {
        requireReadBeforeWrite = perToolConfig.requireReadBeforeWrite;
      }
    }
  }

  return { enabled, requireApproval, requireReadBeforeWrite };
}

/**
 * Creates workspace tools that will be auto-injected into agents.
 *
 * @param workspace - The workspace instance to bind tools to
 * @returns Record of workspace tools
 */
export function createWorkspaceTools(workspace: Workspace) {
  const tools: Record<string, any> = {};
  const toolsConfig = workspace.getToolsConfig();
  const isReadOnly = workspace.filesystem?.readOnly ?? false;

  // Create a shared file read tracker for requireReadBeforeWrite enforcement
  // This is only used by tools, not by direct workspace method calls
  let readTracker: FileReadTracker | undefined;

  // Check if any write tool has requireReadBeforeWrite enabled
  const writeFileConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE);
  const editFileConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE);
  if (writeFileConfig.requireReadBeforeWrite || editFileConfig.requireReadBeforeWrite) {
    readTracker = new InMemoryFileReadTracker();
  }

  // Only add filesystem tools if filesystem is available
  if (workspace.filesystem) {
    // Read file tool
    const readFileConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.READ_FILE);
    if (readFileConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.READ_FILE] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.READ_FILE,
        description:
          'Read the contents of a file from the workspace filesystem. Use offset/limit parameters to read specific line ranges for large files.',
        requireApproval: readFileConfig.requireApproval,
        inputSchema: z.object({
          path: z.string().describe('The path to the file to read (e.g., "/data/config.json")'),
          encoding: z
            .enum(['utf-8', 'utf8', 'base64', 'hex', 'binary'])
            .optional()
            .describe('The encoding to use when reading the file. Defaults to utf-8 for text files.'),
          offset: z
            .number()
            .optional()
            .describe('Line number to start reading from (1-indexed). If omitted, starts from line 1.'),
          limit: z
            .number()
            .optional()
            .describe('Maximum number of lines to read. If omitted, reads to the end of the file.'),
          showLineNumbers: z
            .boolean()
            .optional()
            .default(true)
            .describe('Whether to prefix each line with its line number (default: true)'),
        }),
        outputSchema: z.object({
          content: z.string().describe('The file contents (with optional line number prefixes)'),
          size: z.number().describe('The file size in bytes'),
          path: z.string().describe('The full path to the file'),
          lines: z
            .object({
              start: z.number().describe('First line number returned'),
              end: z.number().describe('Last line number returned'),
            })
            .optional()
            .describe('Line range information (when offset/limit used)'),
          totalLines: z.number().optional().describe('Total number of lines in the file'),
        }),
        execute: async ({ path, encoding, offset, limit, showLineNumbers }) => {
          // Default to utf-8 for text files
          const effectiveEncoding = (encoding as BufferEncoding) ?? 'utf-8';
          const fullContent = await workspace.filesystem!.readFile(path, {
            encoding: effectiveEncoding,
          });
          const stat = await workspace.filesystem!.stat(path);

          // Track the read for requireReadBeforeWrite enforcement
          if (readTracker) {
            readTracker.recordRead(path, stat.modifiedAt);
          }

          // Determine if this is a text encoding that should be line-processed
          // Non-text encodings (base64, hex, binary, etc.) should not be line-processed
          const isTextEncoding = !encoding || encoding === 'utf-8' || encoding === 'utf8';

          // If non-text encoding, return without line processing to avoid corrupting data
          if (!isTextEncoding) {
            return {
              content: fullContent,
              size: stat.size,
              path: stat.path,
            };
          }

          // If content is somehow a Buffer (shouldn't happen with encoding), return as base64
          if (typeof fullContent !== 'string') {
            return {
              content: fullContent.toString('base64'),
              size: stat.size,
              path: stat.path,
            };
          }

          // Extract lines if offset or limit specified
          const hasLineRange = offset !== undefined || limit !== undefined;
          const result = extractLinesWithLimit(fullContent, offset, limit);

          // Format with line numbers if requested (default: true)
          const shouldShowLineNumbers = showLineNumbers !== false;
          const formattedContent = shouldShowLineNumbers
            ? formatWithLineNumbers(result.content, result.lines.start)
            : result.content;

          return {
            content: formattedContent,
            size: stat.size,
            path: stat.path,
            ...(hasLineRange && {
              lines: result.lines,
              totalLines: result.totalLines,
            }),
          };
        },
      });
    }

    // Write file tool (only if not in readonly mode)
    // Note: writeFileConfig was already resolved above for tracker creation
    if (!isReadOnly && writeFileConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE,
        description: 'Write content to a file in the workspace filesystem. Creates parent directories if needed.',
        requireApproval: writeFileConfig.requireApproval,
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
          // Check read-before-write requirement (only for existing files)
          if (readTracker && writeFileConfig.requireReadBeforeWrite) {
            try {
              const stat = await workspace.filesystem!.stat(path);
              const check = readTracker.needsReRead(path, stat.modifiedAt);
              if (check.needsReRead) {
                throw new FileReadRequiredError(path, check.reason!);
              }
            } catch (error) {
              // File doesn't exist - that's fine, no read-before-write check needed for new files
              if (!(error instanceof FileNotFoundError)) {
                throw error;
              }
            }
          }

          await workspace.filesystem!.writeFile(path, content, { overwrite });

          // Clear the read record after successful write (requires a new read to write again)
          if (readTracker) {
            readTracker.clearReadRecord(path);
          }

          return {
            success: true,
            path,
            size: Buffer.byteLength(content, 'utf-8'),
          };
        },
      });
    }

    // Edit file tool (only if not in readonly mode)
    // Note: editFileConfig was already resolved above for tracker creation
    if (!isReadOnly && editFileConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE,
        description: `Edit a file by replacing specific text. The old_string must match exactly and be unique in the file.

Usage:
- Read the file first to get the exact text to replace.
- By default, ${WORKSPACE_TOOLS.FILESYSTEM.READ_FILE} output includes line number prefixes (e.g., "     1→"). Ensure you preserve the exact indentation as it appears AFTER the arrow. Never include any part of the line number prefix in old_string or new_string.
- Include enough surrounding context (multiple lines) to make old_string unique. If it still isn't unique, include more lines.
- Use replace_all only when intentionally replacing all occurrences.`,
        requireApproval: editFileConfig.requireApproval,
        inputSchema: z.object({
          path: z.string().describe('The path to the file to edit'),
          old_string: z.string().describe('The exact text to find and replace. Must be unique in the file.'),
          new_string: z.string().describe('The text to replace old_string with'),
          replace_all: z
            .boolean()
            .optional()
            .default(false)
            .describe('If true, replace all occurrences. If false (default), old_string must be unique.'),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string().describe('The path to the edited file'),
          replacements: z.number().describe('Number of replacements made'),
          error: z.string().optional().describe('Error message if the edit failed'),
        }),
        execute: async ({ path, old_string, new_string, replace_all }) => {
          try {
            // Check read-before-write requirement before reading
            // Edit file needs the file to have been read by the read_file tool first
            if (readTracker && editFileConfig.requireReadBeforeWrite) {
              const stat = await workspace.filesystem!.stat(path);
              const check = readTracker.needsReRead(path, stat.modifiedAt);
              if (check.needsReRead) {
                throw new FileReadRequiredError(path, check.reason!);
              }
            }

            // Read the current file content
            const content = await workspace.filesystem!.readFile(path, { encoding: 'utf-8' });

            if (typeof content !== 'string') {
              return {
                success: false,
                path,
                replacements: 0,
                error: 'Cannot edit binary files. Use workspace_write_file instead.',
              };
            }

            // Perform the replacement with validation
            const result = replaceString(content, old_string, new_string, replace_all);

            // Write the modified content back
            await workspace.filesystem!.writeFile(path, result.content, { overwrite: true });

            // Clear the read record after successful write (requires a new read to write again)
            if (readTracker) {
              readTracker.clearReadRecord(path);
            }

            return {
              success: true,
              path,
              replacements: result.replacements,
            };
          } catch (error) {
            if (error instanceof FileReadRequiredError) {
              throw error; // Re-throw to be handled by caller
            }
            if (error instanceof StringNotFoundError) {
              return {
                success: false,
                path,
                replacements: 0,
                error: error.message,
              };
            }
            if (error instanceof StringNotUniqueError) {
              return {
                success: false,
                path,
                replacements: 0,
                error: error.message,
              };
            }
            throw error;
          }
        },
      });
    }

    // List files tool
    const listFilesConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES);
    if (listFilesConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES] = createTool({
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
        requireApproval: listFilesConfig.requireApproval,
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
          exclude: z
            .string()
            .optional()
            .describe('Pattern to exclude (e.g., "node_modules"). Similar to tree -I flag.'),
          extension: z.string().optional().describe('Filter by file extension (e.g., ".ts"). Similar to tree -P flag.'),
          pattern: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe(
              'Glob pattern(s) to filter files. Examples: "**/*.ts", "src/**/*.test.ts", "*.config.{js,ts}". Directories always pass through.',
            ),
        }),
        outputSchema: z.object({
          tree: z.string().describe('Tree-style directory listing'),
          summary: z.string().describe('Summary of directories and files (e.g., "3 directories, 12 files")'),
          metadata: z
            .object({
              workspace: z
                .object({
                  id: z.string().optional(),
                  name: z.string().optional(),
                })
                .optional(),
              filesystem: z
                .object({
                  id: z.string().optional(),
                  name: z.string().optional(),
                  provider: z.string().optional(),
                })
                .optional(),
            })
            .optional()
            .describe('Metadata about the workspace and filesystem'),
        }),
        execute: async ({ path = '/', maxDepth = 3, showHidden, dirsOnly, exclude, extension, pattern }) => {
          const result = await formatAsTree(workspace.filesystem!, path, {
            maxDepth,
            showHidden,
            dirsOnly,
            exclude: exclude || undefined,
            extension: extension || undefined,
            pattern: pattern || undefined,
          });

          // Include workspace/filesystem metadata for UI display
          const fs = workspace.filesystem!;
          const metadata = {
            workspace: {
              id: workspace.id,
              name: workspace.name,
            },
            filesystem: {
              id: fs.id,
              name: fs.name,
              provider: fs.provider,
            },
          };

          return {
            tree: result.tree,
            summary: result.summary,
            metadata,
          };
        },
      });
    }

    // Delete tool (only if not in readonly mode)
    const deleteConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.DELETE);
    if (!isReadOnly && deleteConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.DELETE] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.DELETE,
        description: 'Delete a file or directory from the workspace filesystem',
        requireApproval: deleteConfig.requireApproval,
        inputSchema: z.object({
          path: z.string().describe('The path to the file or directory to delete'),
          recursive: z
            .boolean()
            .optional()
            .default(false)
            .describe(
              'If true, delete directories and their contents recursively. Required for non-empty directories.',
            ),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          path: z.string(),
        }),
        execute: async ({ path, recursive }) => {
          const stat = await workspace.filesystem!.stat(path);
          if (stat.type === 'directory') {
            await workspace.filesystem!.rmdir(path, { recursive, force: recursive });
          } else {
            await workspace.filesystem!.deleteFile(path);
          }
          return { success: true, path };
        },
      });
    }

    // File stat tool
    const fileStatConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT);
    if (fileStatConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT,
        description:
          'Get file or directory metadata from the workspace. Returns existence, type, size, and modification time.',
        requireApproval: fileStatConfig.requireApproval,
        inputSchema: z.object({
          path: z.string().describe('The path to check'),
        }),
        outputSchema: z.object({
          exists: z.boolean().describe('Whether the path exists'),
          type: z.enum(['file', 'directory', 'none']).describe('The type of the path if it exists'),
          size: z.number().optional().describe('Size in bytes (for files)'),
          modifiedAt: z.string().optional().describe('Last modification time (ISO string)'),
        }),
        execute: async ({ path }) => {
          try {
            const stat = await workspace.filesystem!.stat(path);
            return {
              exists: true,
              type: stat.type,
              size: stat.size,
              modifiedAt: stat.modifiedAt.toISOString(),
            };
          } catch (error) {
            // FileNotFoundError indicates the path doesn't exist
            // Other errors (permissions, I/O) are propagated
            if (error instanceof FileNotFoundError) {
              return { exists: false, type: 'none' as const };
            }
            throw error;
          }
        },
      });
    }

    // Mkdir tool (only if not in readonly mode)
    const mkdirConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.FILESYSTEM.MKDIR);
    if (!isReadOnly && mkdirConfig.enabled) {
      tools[WORKSPACE_TOOLS.FILESYSTEM.MKDIR] = createTool({
        id: WORKSPACE_TOOLS.FILESYSTEM.MKDIR,
        description: 'Create a directory in the workspace filesystem',
        requireApproval: mkdirConfig.requireApproval,
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
    // Search tool
    const searchConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.SEARCH.SEARCH);
    if (searchConfig.enabled) {
      tools[WORKSPACE_TOOLS.SEARCH.SEARCH] = createTool({
        id: WORKSPACE_TOOLS.SEARCH.SEARCH,
        description:
          'Search indexed content in the workspace. Supports keyword (BM25), semantic (vector), and hybrid search modes.',
        requireApproval: searchConfig.requireApproval,
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
    }

    // Index tool (only if not in readonly mode)
    const indexConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.SEARCH.INDEX);
    if (!isReadOnly && indexConfig.enabled) {
      tools[WORKSPACE_TOOLS.SEARCH.INDEX] = createTool({
        id: WORKSPACE_TOOLS.SEARCH.INDEX,
        description: 'Index content for search. The path becomes the document ID in search results.',
        requireApproval: indexConfig.requireApproval,
        inputSchema: z.object({
          path: z.string().describe('The document ID/path for search results'),
          content: z.string().describe('The text content to index'),
          metadata: z
            .record(z.string(), z.unknown())
            .optional()
            .describe('Optional metadata to store with the document'),
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

    // Use provider-supplied instructions
    const pathInfo = pathContext.instructions ? ` ${pathContext.instructions}` : '';

    // Execute command tool (only if sandbox implements it)
    const executeCommandConfig = resolveToolConfig(toolsConfig, WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND);
    if (workspace.sandbox.executeCommand && executeCommandConfig.enabled) {
      tools[WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND] = createTool({
        id: WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND,
        description: `Execute a shell command in the workspace sandbox.${pathInfo}

Usage:
- Verify parent directories exist before running commands that create files or directories.
- Always quote file paths that contain spaces (e.g., cd "/path/with spaces").
- Use the timeout parameter to limit execution time. Behavior when omitted depends on the sandbox provider.
- Use cwd to set the working directory, or commands run from the sandbox default.`,
        requireApproval: executeCommandConfig.requireApproval,
        inputSchema: z.object({
          command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
          args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
          timeout: z
            .number()
            .nullish()
            .describe('Maximum execution time in milliseconds. Example: 60000 for 1 minute.'),
          cwd: z.string().nullish().describe('Working directory for the command'),
        }),
        outputSchema: z.object({
          success: z.boolean().describe('Whether the command executed successfully (exit code 0)'),
          stdout: z.string().describe('Standard output from the command'),
          stderr: z.string().describe('Standard error output'),
          exitCode: z.number().describe('Exit code (0 = success)'),
          executionTimeMs: z.number().describe('How long the execution took in milliseconds'),
        }),
        execute: async ({ command, args, timeout, cwd }, context) => {
          const getExecutionMetadata = () => ({
            workspace: {
              id: workspace.id,
              name: workspace.name,
            },
            sandbox: {
              id: workspace.sandbox?.id,
              name: workspace.sandbox?.name,
              provider: workspace.sandbox?.provider,
              status: workspace.sandbox?.status,
            },
          });

          const startedAt = Date.now();
          try {
            const result = await workspace.sandbox!.executeCommand!(command, args ?? [], {
              timeout: timeout ?? undefined,
              cwd: cwd ?? undefined,
              // Stream stdout/stderr as tool-output chunks for proper UI integration
              onStdout: async (data: string) => {
                await context?.writer?.write({
                  type: 'sandbox-stdout',
                  data,
                  timestamp: Date.now(),
                  metadata: getExecutionMetadata(),
                });
              },
              onStderr: async (data: string) => {
                await context?.writer?.write({
                  type: 'sandbox-stderr',
                  data,
                  timestamp: Date.now(),
                  metadata: getExecutionMetadata(),
                });
              },
            });
            // Emit exit chunk so UI knows streaming is complete
            await context?.writer?.write({
              type: 'sandbox-exit',
              exitCode: result.exitCode,
              success: result.success,
              executionTimeMs: result.executionTimeMs,
              metadata: getExecutionMetadata(),
            });
            return {
              success: result.success,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode,
              executionTimeMs: result.executionTimeMs,
            };
          } catch (error) {
            // Always emit exit chunk on error so UI knows streaming is complete
            await context?.writer?.write({
              type: 'sandbox-exit',
              exitCode: -1,
              success: false,
              executionTimeMs: Date.now() - startedAt,
              metadata: getExecutionMetadata(),
            });
            throw error;
          }
        },
      });
    }
  }

  return tools;
}
