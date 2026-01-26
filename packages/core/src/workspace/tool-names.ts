/**
 * Workspace Tool Name Constants
 *
 * This file contains only string constants with no dependencies,
 * making it safe to import in both Node.js and browser environments.
 */

export const WORKSPACE_TOOLS_PREFIX = 'mastra_workspace' as const;
const TOOLS_NAMESPACE = WORKSPACE_TOOLS_PREFIX;

/**
 * Workspace tool name constants.
 * Use these to reference workspace tools by name.
 *
 * @example
 * ```typescript
 * import { WORKSPACE_TOOLS } from '@mastra/core/workspace/tool-names';
 *
 * if (toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) {
 *   // Handle sandbox execution
 * }
 * ```
 */
export const WORKSPACE_TOOLS = {
  FILESYSTEM: {
    READ_FILE: `${TOOLS_NAMESPACE}_read_file` as const,
    WRITE_FILE: `${TOOLS_NAMESPACE}_write_file` as const,
    EDIT_FILE: `${TOOLS_NAMESPACE}_edit_file` as const,
    LIST_FILES: `${TOOLS_NAMESPACE}_list_files` as const,
    DELETE_FILE: `${TOOLS_NAMESPACE}_delete_file` as const,
    FILE_EXISTS: `${TOOLS_NAMESPACE}_file_exists` as const,
    MKDIR: `${TOOLS_NAMESPACE}_mkdir` as const,
  },
  SANDBOX: {
    EXECUTE_COMMAND: `${TOOLS_NAMESPACE}_execute_command` as const,
    INSTALL_PACKAGE: `${TOOLS_NAMESPACE}_install_package` as const,
  },
  SEARCH: {
    SEARCH: `${TOOLS_NAMESPACE}_search` as const,
    INDEX: `${TOOLS_NAMESPACE}_index` as const,
  },
} as const;

/**
 * Type representing any workspace tool name.
 */
export type WorkspaceToolName =
  | (typeof WORKSPACE_TOOLS.FILESYSTEM)[keyof typeof WORKSPACE_TOOLS.FILESYSTEM]
  | (typeof WORKSPACE_TOOLS.SEARCH)[keyof typeof WORKSPACE_TOOLS.SEARCH]
  | (typeof WORKSPACE_TOOLS.SANDBOX)[keyof typeof WORKSPACE_TOOLS.SANDBOX];
