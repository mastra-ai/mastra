import { WORKSPACE_TOOLS } from '../../workspace/constants';

const FILE_MUTATION_PATH_ARG_BY_TOOL = new Map<string, string>([
  [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE, 'path'],
  [WORKSPACE_TOOLS.FILESYSTEM.MKDIR, 'path'],
  [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, 'path'],
  [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT, 'path'],
  [WORKSPACE_TOOLS.FILESYSTEM.DELETE, 'path'],
  [WORKSPACE_TOOLS.SEARCH.INDEX, 'path'],
  ['write_file', 'path'],
  ['mkdir', 'path'],
  ['string_replace_lsp', 'path'],
  ['ast_smart_edit', 'path'],
  ['delete_file', 'path'],
]);

export function isHarnessWorkspaceFileMutationTool(toolName: string): boolean {
  return FILE_MUTATION_PATH_ARG_BY_TOOL.has(toolName);
}

export function getHarnessWorkspaceActionPathInput(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  const pathArg = FILE_MUTATION_PATH_ARG_BY_TOOL.get(toolName);
  if (!pathArg) return undefined;
  const value = args[pathArg];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
