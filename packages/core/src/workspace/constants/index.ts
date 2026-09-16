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
  COMPUTER: {
    SCREENSHOT: `${WORKSPACE_TOOLS_PREFIX}_computer_screenshot` as const,
    CLICK: `${WORKSPACE_TOOLS_PREFIX}_computer_click` as const,
    DOUBLE_CLICK: `${WORKSPACE_TOOLS_PREFIX}_computer_double_click` as const,
    RIGHT_CLICK: `${WORKSPACE_TOOLS_PREFIX}_computer_right_click` as const,
    MOVE_MOUSE: `${WORKSPACE_TOOLS_PREFIX}_computer_move_mouse` as const,
    DRAG: `${WORKSPACE_TOOLS_PREFIX}_computer_drag` as const,
    TYPE: `${WORKSPACE_TOOLS_PREFIX}_computer_type` as const,
    PRESS_KEY: `${WORKSPACE_TOOLS_PREFIX}_computer_press_key` as const,
    SCROLL: `${WORKSPACE_TOOLS_PREFIX}_computer_scroll` as const,
    GET_SCREEN_INFO: `${WORKSPACE_TOOLS_PREFIX}_computer_get_screen_info` as const,
    WAIT: `${WORKSPACE_TOOLS_PREFIX}_computer_wait` as const,
  },
  SEARCH: {
    SEARCH: `${WORKSPACE_TOOLS_PREFIX}_search` as const,
    INDEX: `${WORKSPACE_TOOLS_PREFIX}_index` as const,
  },
  LSP: {
    LSP_INSPECT: `${WORKSPACE_TOOLS_PREFIX}_lsp_inspect` as const,
  },
} as const;

/**
 * Type representing any workspace tool name.
 */
export type WorkspaceToolName =
  | (typeof WORKSPACE_TOOLS.FILESYSTEM)[keyof typeof WORKSPACE_TOOLS.FILESYSTEM]
  | (typeof WORKSPACE_TOOLS.SEARCH)[keyof typeof WORKSPACE_TOOLS.SEARCH]
  | (typeof WORKSPACE_TOOLS.SANDBOX)[keyof typeof WORKSPACE_TOOLS.SANDBOX]
  | (typeof WORKSPACE_TOOLS.COMPUTER)[keyof typeof WORKSPACE_TOOLS.COMPUTER]
  | (typeof WORKSPACE_TOOLS.LSP)[keyof typeof WORKSPACE_TOOLS.LSP];
