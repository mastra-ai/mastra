export const WORKSPACE_TOOLS_PREFIX = 'mastra_workspace' as const;

/**
 * Workspace tool name constants.
 * Use these to reference workspace tools by name.
 *
 * @example
 * ```typescript
 * import { WORKSPACE_TOOLS } from '@mastra/core/workspace';
 *
 * if (toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) {
 *   // Handle sandbox execution
 * }
 * ```
 */
export const WORKSPACE_TOOLS = {
  FILESYSTEM: {
    READ_FILE: `${WORKSPACE_TOOLS_PREFIX}_read_file` as const,
    WRITE_FILE: `${WORKSPACE_TOOLS_PREFIX}_write_file` as const,
    EDIT_FILE: `${WORKSPACE_TOOLS_PREFIX}_edit_file` as const,
    LIST_FILES: `${WORKSPACE_TOOLS_PREFIX}_list_files` as const,
    DELETE: `${WORKSPACE_TOOLS_PREFIX}_delete` as const,
    FILE_STAT: `${WORKSPACE_TOOLS_PREFIX}_file_stat` as const,
    MKDIR: `${WORKSPACE_TOOLS_PREFIX}_mkdir` as const,
    GREP: `${WORKSPACE_TOOLS_PREFIX}_grep` as const,
    AST_EDIT: `${WORKSPACE_TOOLS_PREFIX}_ast_edit` as const,
  },
  SANDBOX: {
    EXECUTE_COMMAND: `${WORKSPACE_TOOLS_PREFIX}_execute_command` as const,
    GET_PROCESS_OUTPUT: `${WORKSPACE_TOOLS_PREFIX}_get_process_output` as const,
    KILL_PROCESS: `${WORKSPACE_TOOLS_PREFIX}_kill_process` as const,
  },
  SEARCH: {
    SEARCH: `${WORKSPACE_TOOLS_PREFIX}_search` as const,
    INDEX: `${WORKSPACE_TOOLS_PREFIX}_index` as const,
  },
} as const;

/**
 * Type representing any workspace tool name.
 */
export type WorkspaceToolName =
  | (typeof WORKSPACE_TOOLS.FILESYSTEM)[keyof typeof WORKSPACE_TOOLS.FILESYSTEM]
  | (typeof WORKSPACE_TOOLS.SEARCH)[keyof typeof WORKSPACE_TOOLS.SEARCH]
  | (typeof WORKSPACE_TOOLS.SANDBOX)[keyof typeof WORKSPACE_TOOLS.SANDBOX];
