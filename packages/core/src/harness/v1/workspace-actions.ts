import { WORKSPACE_TOOLS } from '../../workspace/constants';

export type HarnessWorkspaceActionKind = 'file' | 'command';

export interface HarnessWorkspaceToolAction<TPath = unknown> {
  actionKind: HarnessWorkspaceActionKind;
  operation: string;
  action: Record<string, unknown>;
  mutatesWorkspace: boolean;
  pathInput?: string;
  path?: TPath;
  toPathInput?: string;
  toPath?: TPath;
  cwdInput?: string;
  cwd?: TPath;
}

export type HarnessWorkspaceToolNameConfig = Record<string, { name?: string | undefined } | undefined>;

interface HarnessWorkspaceToolDescriptor {
  names: readonly [string, ...string[]];
  actionKind: HarnessWorkspaceActionKind;
  operation: string;
  mutatesWorkspace: boolean;
  pathArg?: string;
  toPathArg?: string;
  cwdArg?: string;
  defaultPath?: string;
  action(args: Record<string, unknown>): Record<string, unknown>;
}

const fileAction = (operation: string): Record<string, unknown> => ({ kind: 'file', operation });

const readFileTools: HarnessWorkspaceToolDescriptor[] = [
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.READ_FILE, 'view'],
    actionKind: 'file',
    operation: 'read',
    mutatesWorkspace: false,
    pathArg: 'path',
    action: () => fileAction('read'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.LIST_FILES, 'find_files'],
    actionKind: 'file',
    operation: 'read',
    mutatesWorkspace: false,
    pathArg: 'path',
    defaultPath: '.',
    action: () => fileAction('read'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.FILE_STAT, 'file_stat'],
    actionKind: 'file',
    operation: 'read',
    mutatesWorkspace: false,
    pathArg: 'path',
    action: () => fileAction('read'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.GREP, 'search_content'],
    actionKind: 'file',
    operation: 'read',
    mutatesWorkspace: false,
    pathArg: 'path',
    defaultPath: '.',
    action: () => fileAction('read'),
  },
  {
    names: [WORKSPACE_TOOLS.LSP.LSP_INSPECT, 'lsp_inspect'],
    actionKind: 'file',
    operation: 'read',
    mutatesWorkspace: false,
    pathArg: 'path',
    action: args => ({
      ...fileAction('read'),
      ...(typeof args.line === 'number' ? { line: args.line } : {}),
    }),
  },
];

const writeFileTools: HarnessWorkspaceToolDescriptor[] = [
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE, 'write_file'],
    actionKind: 'file',
    operation: 'write',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('write'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.MKDIR, 'mkdir'],
    actionKind: 'file',
    operation: 'write',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('write'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE, 'string_replace_lsp'],
    actionKind: 'file',
    operation: 'patch',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('patch'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT, 'ast_smart_edit'],
    actionKind: 'file',
    operation: 'patch',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('patch'),
  },
  {
    names: [WORKSPACE_TOOLS.FILESYSTEM.DELETE, 'delete_file'],
    actionKind: 'file',
    operation: 'delete',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('delete'),
  },
  {
    names: [WORKSPACE_TOOLS.SEARCH.INDEX],
    actionKind: 'file',
    operation: 'index',
    mutatesWorkspace: true,
    pathArg: 'path',
    action: () => fileAction('index'),
  },
];

const sandboxTools: HarnessWorkspaceToolDescriptor[] = [
  {
    names: [WORKSPACE_TOOLS.SEARCH.SEARCH],
    actionKind: 'file',
    operation: 'search',
    mutatesWorkspace: false,
    action: args => ({
      kind: 'file',
      operation: 'search',
      query: typeof args.query === 'string' ? args.query : '',
      ...(typeof args.topK === 'number' ? { topK: args.topK } : {}),
      ...(typeof args.mode === 'string' ? { mode: args.mode } : {}),
      ...(typeof args.minScore === 'number' ? { minScore: args.minScore } : {}),
    }),
  },
  {
    names: [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND, 'execute_command'],
    actionKind: 'command',
    operation: 'execute',
    mutatesWorkspace: true,
    cwdArg: 'cwd',
    action: args => ({
      kind: 'command',
      command: typeof args.command === 'string' ? args.command : '',
      ...(typeof args.cwd === 'string' ? { cwd: args.cwd } : {}),
      ...(Array.isArray(args.args) ? { args: args.args } : {}),
      ...(typeof args.background === 'boolean' ? { background: args.background } : {}),
    }),
  },
  {
    names: [WORKSPACE_TOOLS.SANDBOX.GET_PROCESS_OUTPUT, 'get_process_output'],
    actionKind: 'command',
    operation: 'read_output',
    mutatesWorkspace: false,
    action: args => ({
      kind: 'command',
      operation: 'read_output',
      pid: typeof args.pid === 'string' ? args.pid : '',
      ...(typeof args.tail === 'number' ? { tail: args.tail } : {}),
      ...(typeof args.wait === 'boolean' ? { wait: args.wait } : {}),
    }),
  },
  {
    names: [WORKSPACE_TOOLS.SANDBOX.KILL_PROCESS, 'kill_process'],
    actionKind: 'command',
    operation: 'kill',
    mutatesWorkspace: true,
    action: args => ({
      kind: 'command',
      operation: 'kill',
      pid: typeof args.pid === 'string' ? args.pid : '',
    }),
  },
];

const WORKSPACE_TOOL_DESCRIPTORS = [...readFileTools, ...writeFileTools, ...sandboxTools] as const;
const WORKSPACE_TOOL_DESCRIPTOR_BY_NAME = new Map<string, HarnessWorkspaceToolDescriptor>();

for (const descriptor of WORKSPACE_TOOL_DESCRIPTORS) {
  for (const name of descriptor.names) {
    WORKSPACE_TOOL_DESCRIPTOR_BY_NAME.set(name, descriptor);
  }
}

export function classifyHarnessWorkspaceToolAction<TPath = unknown>(
  toolName: string,
  args: Record<string, unknown>,
  options: {
    pathFor?: (inputPath: string) => TPath;
    toolNameConfig?: HarnessWorkspaceToolNameConfig | undefined;
  } = {},
): HarnessWorkspaceToolAction<TPath> | undefined {
  const descriptor = WORKSPACE_TOOL_DESCRIPTOR_BY_NAME.get(toolName) ?? descriptorForConfiguredName(toolName, options);
  if (!descriptor) return undefined;

  const pathInput = stringArg(args, descriptor.pathArg) ?? descriptor.defaultPath;
  const toPathInput = stringArg(args, descriptor.toPathArg);
  const cwdInput = stringArg(args, descriptor.cwdArg);
  if (descriptor.pathArg && !pathInput) return undefined;

  return {
    actionKind: descriptor.actionKind,
    operation: descriptor.operation,
    action: {
      ...descriptor.action(args),
      toolName,
      canonicalToolName: descriptor.names[0],
    },
    mutatesWorkspace: descriptor.mutatesWorkspace,
    ...(pathInput ? { pathInput } : {}),
    ...(pathInput && options.pathFor ? { path: options.pathFor(pathInput) } : {}),
    ...(toPathInput ? { toPathInput } : {}),
    ...(toPathInput && options.pathFor ? { toPath: options.pathFor(toPathInput) } : {}),
    ...(cwdInput ? { cwdInput } : {}),
    ...(cwdInput && options.pathFor ? { cwd: options.pathFor(cwdInput) } : {}),
  };
}

export function isHarnessWorkspaceFileMutationTool(toolName: string): boolean {
  const descriptor = WORKSPACE_TOOL_DESCRIPTOR_BY_NAME.get(toolName);
  return Boolean(descriptor?.actionKind === 'file' && descriptor.mutatesWorkspace);
}

export function getHarnessWorkspaceActionPathInput(
  toolName: string,
  args: Record<string, unknown>,
): string | undefined {
  const descriptor = WORKSPACE_TOOL_DESCRIPTOR_BY_NAME.get(toolName);
  return stringArg(args, descriptor?.pathArg);
}

function stringArg(args: Record<string, unknown>, key: string | undefined): string | undefined {
  if (!key) return undefined;
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function descriptorForConfiguredName(
  toolName: string,
  options: { toolNameConfig?: HarnessWorkspaceToolNameConfig | undefined },
): HarnessWorkspaceToolDescriptor | undefined {
  const config = options.toolNameConfig;
  if (!config) return undefined;
  for (const descriptor of WORKSPACE_TOOL_DESCRIPTORS) {
    const canonicalToolName = descriptor.names[0];
    if (config[canonicalToolName]?.name === toolName) return descriptor;
  }
  return undefined;
}
