import { WORKSPACE_TOOLS } from '../../workspace/constants';

/**
 * Kinds of workspace actions the runtime journals. `'file'` and `'command'`
 * cover the local-workspace tools enumerated in `WORKSPACE_TOOL_DESCRIPTORS`
 * below. `'mcp'` is detected via the `mcpServerKeys` option (tool names
 * namespaced `<serverKey>_<toolName>`). `'network'` is detected by inspecting
 * the tool's args for a top-level `url` / `endpoint` / `uri` field that
 * parses through `new URL()`.
 *
 * Storage and `workspace-policy.ts` already accept all four kinds; only the
 * classifier was previously restricted to file/command, so MCP/network tool
 * calls escaped the durable journal.
 */
export type HarnessWorkspaceActionKind = 'file' | 'command' | 'network' | 'mcp';

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
    /**
     * Registered MCP server keys. A tool name shaped `<key>_<rest>` is
     * classified as `actionKind: 'mcp'` with `{serverId: <key>, toolName: <rest>}`.
     * Longest-prefix match wins so overlapping keys (e.g. `weather` and
     * `weather_eu`) classify deterministically.
     */
    mcpServerKeys?: readonly string[];
  } = {},
): HarnessWorkspaceToolAction<TPath> | undefined {
  const descriptor = WORKSPACE_TOOL_DESCRIPTOR_BY_NAME.get(toolName) ?? descriptorForConfiguredName(toolName, options);
  if (descriptor) {
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

  // No file/command match. Try MCP namespace match next (longest-prefix wins).
  const mcpMatch = matchMcpServerKey(toolName, options.mcpServerKeys);
  if (mcpMatch) {
    return {
      actionKind: 'mcp',
      operation: 'call',
      action: {
        kind: 'mcp',
        serverId: mcpMatch.serverId,
        toolName: mcpMatch.toolName,
        canonicalToolName: mcpMatch.toolName,
      },
      mutatesWorkspace: false,
    };
  }

  // Fall through to network classification via top-level URL field. Skipped
  // when the args carry no parseable URL — the runtime simply does not
  // journal the call. This matches the pre-change behavior for unrecognized
  // tools rather than emitting a fabricated row.
  const networkAction = detectNetworkAction(args);
  if (networkAction) {
    return {
      actionKind: 'network',
      operation: networkAction.operation,
      action: {
        kind: 'network',
        toolName,
        canonicalToolName: toolName,
        ...networkAction.payload,
      },
      mutatesWorkspace: false,
    };
  }

  return undefined;
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

/**
 * Match a tool name against a list of MCP server keys, returning the
 * longest-prefix match so overlapping keys (e.g. `weather` and `weather_eu`)
 * resolve deterministically to the more-specific server.
 */
function matchMcpServerKey(
  toolName: string,
  keys: readonly string[] | undefined,
): { serverId: string; toolName: string } | undefined {
  if (!keys || keys.length === 0) return undefined;
  let best: { serverId: string; toolName: string } | undefined;
  for (const key of keys) {
    if (typeof key !== 'string' || key.length === 0) continue;
    const prefix = `${key}_`;
    if (!toolName.startsWith(prefix)) continue;
    const rest = toolName.slice(prefix.length);
    if (rest.length === 0) continue;
    if (!best || key.length > best.serverId.length) {
      best = { serverId: key, toolName: rest };
    }
  }
  return best;
}

/**
 * Detect a network call by inspecting the tool's args for a top-level URL
 * field. Recognized aliases are `url`, `endpoint`, `uri`. Returns the
 * extracted payload (host / port / protocol / method / url) when the value
 * parses through `new URL()`; returns `undefined` for non-string values or
 * unparseable URLs so non-network tools do not produce fabricated journal
 * rows.
 */
/** Network schemes whose `new URL()` parse carries a meaningful host. Schemes
 * outside this set (file, data, mailto, blob, javascript, etc.) parse cleanly
 * but produce empty or opaque host fields, so they are NOT journaled as
 * network actions to avoid taxonomy false positives. */
const NETWORK_SCHEME_WHITELIST = new Set(['http', 'https', 'ws', 'wss']);

function detectNetworkAction(
  args: Record<string, unknown>,
): { operation: string; payload: Record<string, unknown> } | undefined {
  const NETWORK_URL_FIELDS = ['url', 'endpoint', 'uri'] as const;
  let urlString: string | undefined;
  for (const field of NETWORK_URL_FIELDS) {
    const value = args[field];
    if (typeof value === 'string' && value.length > 0) {
      urlString = value;
      break;
    }
  }
  if (urlString === undefined) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return undefined;
  }
  const protocol = parsed.protocol.replace(/:$/, '');
  // Restrict to host-bearing network schemes. `new URL()` happily parses
  // `file:///tmp/x`, `data:...`, `mailto:...`, etc., and those would otherwise
  // produce `actionKind: 'network'` rows with an empty hostname — false
  // positives that pollute the audit journal. Whitelisted schemes here are
  // the ones the journal's `host`/`port`/`protocol` payload is meaningful for.
  if (!NETWORK_SCHEME_WHITELIST.has(protocol)) return undefined;
  if (parsed.hostname.length === 0) return undefined;
  const portValue = parsed.port.length > 0 ? Number(parsed.port) : defaultPortForProtocol(protocol);
  const method = typeof args.method === 'string' && args.method.length > 0 ? args.method.toUpperCase() : undefined;
  const operation = method ?? 'request';
  return {
    operation,
    payload: {
      operation,
      host: parsed.hostname,
      ...(portValue !== undefined ? { port: portValue } : {}),
      protocol,
      url: parsed.toString(),
      ...(method ? { method } : {}),
    },
  };
}

function defaultPortForProtocol(protocol: string): number | undefined {
  switch (protocol) {
    case 'http':
      return 80;
    case 'https':
      return 443;
    case 'ws':
      return 80;
    case 'wss':
      return 443;
    default:
      return undefined;
  }
}
