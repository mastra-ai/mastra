import fs from 'node:fs';
import path from 'node:path';

import type { PermissionPolicy } from '../types';

export type WorkspacePolicyActionKind = 'file' | 'command' | 'network' | 'mcp';
export type WorkspaceFileOperation = 'read' | 'write' | 'delete' | 'rename' | 'patch';

export interface WorkspaceRootDescriptor {
  id: string;
  path: string;
  label?: string;
  /**
   * When omitted, the root is treated as writable. Set to false to deny mutating file operations before rules run.
   */
  writable?: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceFilePolicyAction {
  kind: 'file';
  operation: WorkspaceFileOperation;
  path: string;
  rootId?: string;
  toPath?: string;
}

export interface WorkspaceCommandPolicyAction {
  kind: 'command';
  command: string;
  rootId?: string;
  cwd?: string;
  args?: readonly string[];
}

export interface WorkspaceNetworkPolicyAction {
  kind: 'network';
  host: string;
  port?: number;
  protocol?: string;
}

export interface WorkspaceMcpPolicyAction {
  kind: 'mcp';
  serverId: string;
  toolName?: string;
}

export type WorkspacePolicyAction =
  | WorkspaceFilePolicyAction
  | WorkspaceCommandPolicyAction
  | WorkspaceNetworkPolicyAction
  | WorkspaceMcpPolicyAction;

export interface WorkspacePolicyRule {
  id?: string;
  kind?: WorkspacePolicyActionKind | readonly WorkspacePolicyActionKind[];
  operation?: WorkspaceFileOperation | readonly WorkspaceFileOperation[];
  rootId?: string | readonly string[];
  command?: string | readonly string[];
  networkHost?: string | readonly string[];
  networkPort?: number | readonly number[];
  networkProtocol?: string | readonly string[];
  mcpServerId?: string | readonly string[];
  mcpToolName?: string | readonly string[];
  decision: PermissionPolicy;
  reason?: string;
}

export interface WorkspacePolicy {
  roots: readonly WorkspaceRootDescriptor[];
  defaultDecision?: PermissionPolicy;
  rules?: readonly WorkspacePolicyRule[];
}

export interface WorkspaceResolvedPath {
  root: WorkspaceRootDescriptor;
  normalizedPath: string;
  relativePath: string;
}

export interface WorkspacePolicyMatchedRule {
  id?: string;
  decision: PermissionPolicy;
  reason?: string;
}

export interface WorkspacePolicyEvaluation {
  decision: PermissionPolicy;
  reasons: string[];
  matchedRules: WorkspacePolicyMatchedRule[];
  path?: WorkspaceResolvedPath;
  toPath?: WorkspaceResolvedPath;
  cwd?: WorkspaceResolvedPath;
}

const MUTATING_FILE_OPERATIONS = new Set<WorkspaceFileOperation>(['write', 'delete', 'rename', 'patch']);

export function evaluateWorkspacePolicy(
  policy: WorkspacePolicy,
  action: WorkspacePolicyAction,
): WorkspacePolicyEvaluation {
  const reasons: string[] = [];
  let resolvedPath: WorkspaceResolvedPath | undefined;
  let resolvedToPath: WorkspaceResolvedPath | undefined;
  let resolvedCwd: WorkspaceResolvedPath | undefined;
  let commandRootId: string | undefined;

  if (action.kind === 'file') {
    const resolved = resolveWorkspaceFileAction(policy.roots, action);
    if (resolved.status === 'denied') {
      return {
        decision: 'deny',
        reasons: [resolved.reason],
        matchedRules: [],
      };
    }
    resolvedPath = resolved.path;
    resolvedToPath = resolved.toPath;
    if (isMutatingFileOperation(action.operation)) {
      const readOnlyRoot = [resolvedPath.root, resolvedToPath?.root].find(root => root?.writable === false);
      if (readOnlyRoot) {
        return {
          decision: 'deny',
          reasons: [`workspace.root_readonly:${readOnlyRoot.id}`],
          matchedRules: [],
          path: resolvedPath,
          ...(resolvedToPath ? { toPath: resolvedToPath } : {}),
        };
      }
    }
  } else if (action.kind === 'command' && (action.cwd !== undefined || action.rootId !== undefined)) {
    const commandContext =
      action.cwd !== undefined
        ? resolveWorkspaceActionPath(policy.roots, action.cwd, action.rootId)
        : resolveWorkspaceCommandRoot(policy.roots, action.rootId);
    if (!commandContext) {
      return {
        decision: 'deny',
        reasons: [action.cwd !== undefined ? 'workspace.cwd_outside_roots' : 'workspace.root_not_found'],
        matchedRules: [],
      };
    }
    resolvedCwd = action.cwd !== undefined ? commandContext : undefined;
    commandRootId = commandContext.root.id;
  }

  const matchedRules = (policy.rules ?? [])
    .filter(rule => ruleMatches(rule, action, resolvedPath, resolvedToPath, commandRootId))
    .map(rule => ({
      id: rule.id,
      decision: rule.decision,
      reason: rule.reason,
    }));

  for (const rule of matchedRules) {
    if (rule.reason) reasons.push(rule.reason);
  }

  const decision = strongestDecision(
    matchedRules.map(rule => rule.decision),
    policy.defaultDecision ?? 'ask',
  );
  if (matchedRules.length === 0) reasons.push(`workspace.default_${decision}`);

  return {
    decision,
    reasons,
    matchedRules,
    ...(resolvedPath ? { path: resolvedPath } : {}),
    ...(resolvedToPath ? { toPath: resolvedToPath } : {}),
    ...(resolvedCwd ? { cwd: resolvedCwd } : {}),
  };
}

function resolveWorkspaceFileAction(
  roots: readonly WorkspaceRootDescriptor[],
  action: WorkspaceFilePolicyAction,
):
  | { status: 'allowed'; path: WorkspaceResolvedPath; toPath?: WorkspaceResolvedPath }
  | { status: 'denied'; reason: string } {
  const resolvedPath = resolveWorkspaceActionPath(roots, action.path, action.rootId);
  if (!resolvedPath) {
    return { status: 'denied', reason: 'workspace.path_outside_roots' };
  }

  if (action.operation === 'rename' && action.toPath === undefined) {
    return { status: 'denied', reason: 'workspace.target_path_required' };
  }

  if (action.toPath === undefined) {
    return { status: 'allowed', path: resolvedPath };
  }

  const resolvedToPath = resolveWorkspaceActionPath(roots, action.toPath, action.rootId);
  if (!resolvedToPath) {
    return { status: 'denied', reason: 'workspace.target_path_outside_roots' };
  }

  return { status: 'allowed', path: resolvedPath, toPath: resolvedToPath };
}

function resolveWorkspaceActionPath(
  roots: readonly WorkspaceRootDescriptor[],
  inputPath: string,
  rootId?: string,
): WorkspaceResolvedPath | null {
  const requestedPath = resolveWorkspacePath(roots, inputPath, rootId);
  if (!requestedPath) return null;

  const canonicalPath = resolveWorkspacePath(roots, requestedPath.normalizedPath);
  if (!canonicalPath) return requestedPath;

  if (
    rootId !== undefined &&
    canonicalPath.root.id !== requestedPath.root.id &&
    canonicalPath.root.path === requestedPath.root.path
  ) {
    return requestedPath;
  }

  return canonicalPath;
}

function resolveWorkspaceCommandRoot(
  roots: readonly WorkspaceRootDescriptor[],
  rootId: string | undefined,
): WorkspaceResolvedPath | null {
  if (rootId === undefined) return null;
  const root = roots.find(candidate => candidate.id === rootId);
  if (!root) return null;
  return resolveWorkspacePath(roots, '.', rootId);
}

export function resolveWorkspacePath(
  roots: readonly WorkspaceRootDescriptor[],
  inputPath: string,
  rootId?: string,
): WorkspaceResolvedPath | null {
  if (!isUsablePath(inputPath)) return null;

  const candidateRoots = rootId === undefined ? roots : roots.filter(root => root.id === rootId);
  if (candidateRoots.length === 0) return null;

  const resolved = candidateRoots
    .map(root => resolveAgainstRoot(root, inputPath))
    .filter((item): item is WorkspaceResolvedPath => item !== null)
    .sort((left, right) => right.root.path.length - left.root.path.length);

  return resolved[0] ?? null;
}

function resolveAgainstRoot(root: WorkspaceRootDescriptor, inputPath: string): WorkspaceResolvedPath | null {
  if (!isUsablePath(root.id) || !isUsablePath(root.path)) return null;

  const flavor = pathFlavorFor(root.path, inputPath);
  const pathApi = flavor === 'win32' ? path.win32 : path.posix;
  const normalizedRoot = normalizeAbsolutePath(root.path, pathApi);
  if (!normalizedRoot) return null;

  const normalizedPath = pathApi.isAbsolute(inputPath)
    ? pathApi.normalize(inputPath)
    : pathApi.resolve(normalizedRoot, inputPath);
  const relativePath = pathApi.relative(normalizedRoot, normalizedPath);

  if (relativePath === '') {
    return { root: { ...root, path: normalizedRoot }, normalizedPath, relativePath: '.' };
  }
  if (isOutsideRelativePath(relativePath, pathApi)) return null;
  if (escapesRootByRealpath(normalizedRoot, normalizedPath, pathApi)) return null;

  return { root: { ...root, path: normalizedRoot }, normalizedPath, relativePath };
}

function normalizeAbsolutePath(value: string, pathApi: typeof path.posix | typeof path.win32): string | null {
  if (!isUsablePath(value)) return null;
  const normalized = pathApi.normalize(value);
  return pathApi.isAbsolute(normalized) ? normalized : null;
}

function isOutsideRelativePath(relativePath: string, pathApi: typeof path.posix | typeof path.win32): boolean {
  return relativePath === '..' || relativePath.startsWith(`..${pathApi.sep}`) || pathApi.isAbsolute(relativePath);
}

function escapesRootByRealpath(
  normalizedRoot: string,
  normalizedPath: string,
  pathApi: typeof path.posix | typeof path.win32,
): boolean {
  const realRoot = realpathIfExists(normalizedRoot);
  if (!realRoot) return false;

  const nearestRealPath =
    realpathIfExists(normalizedPath) ?? realpathIfExists(nearestExistingPath(normalizedPath, pathApi));
  if (!nearestRealPath) return false;

  const relativeRealPath = pathApi.relative(realRoot, nearestRealPath);
  return isOutsideRelativePath(relativeRealPath, pathApi);
}

function realpathIfExists(value: string | null): string | null {
  if (!value) return null;

  try {
    return fs.realpathSync.native(value);
  } catch {
    // Missing or inaccessible paths fall back to lexical containment checks above.
    return null;
  }
}

function nearestExistingPath(inputPath: string, pathApi: typeof path.posix | typeof path.win32): string | null {
  let current = inputPath;

  while (current !== pathApi.dirname(current)) {
    if (fs.existsSync(current)) return current;
    current = pathApi.dirname(current);
  }

  return fs.existsSync(current) ? current : null;
}

function pathFlavorFor(...values: string[]): 'posix' | 'win32' {
  return values.some(value => /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('\\\\')) ? 'win32' : 'posix';
}

function isUsablePath(value: string): boolean {
  return value.length > 0 && !value.includes('\0');
}

function ruleMatches(
  rule: WorkspacePolicyRule,
  action: WorkspacePolicyAction,
  resolvedPath: WorkspaceResolvedPath | undefined,
  resolvedToPath: WorkspaceResolvedPath | undefined,
  commandRootId: string | undefined,
): boolean {
  if (!matchesValue(rule.kind, action.kind)) return false;

  if (action.kind === 'file') {
    return (
      matchesValue(rule.operation, action.operation) &&
      matchesFileRootSelector(rule, [resolvedPath?.root.id, resolvedToPath?.root.id]) &&
      rule.command === undefined &&
      rule.networkHost === undefined &&
      rule.networkPort === undefined &&
      rule.networkProtocol === undefined &&
      rule.mcpServerId === undefined &&
      rule.mcpToolName === undefined
    );
  }
  if (rule.operation !== undefined) return false;

  if (action.kind === 'command') {
    return (
      matchesValue(rule.command, action.command) &&
      matchesValue(rule.rootId, commandRootId) &&
      rule.networkHost === undefined &&
      rule.networkPort === undefined &&
      rule.networkProtocol === undefined &&
      rule.mcpServerId === undefined &&
      rule.mcpToolName === undefined
    );
  }
  if (rule.rootId !== undefined) return false;

  if (action.kind === 'network') {
    return (
      matchesNetworkHost(rule.networkHost, action.host) &&
      matchesValue(rule.networkPort, action.port) &&
      matchesNetworkProtocol(rule.networkProtocol, action.protocol) &&
      rule.command === undefined &&
      rule.mcpServerId === undefined &&
      rule.mcpToolName === undefined
    );
  }
  return (
    matchesValue(rule.mcpServerId, action.serverId) &&
    matchesValue(rule.mcpToolName, action.toolName) &&
    rule.command === undefined &&
    rule.networkHost === undefined &&
    rule.networkPort === undefined &&
    rule.networkProtocol === undefined
  );
}

function matchesValue<T extends number | string>(
  expected: T | readonly T[] | undefined,
  actual: T | undefined,
): boolean {
  if (expected === undefined) return true;
  if (actual === undefined) return false;
  return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
}

function matchesAnyValue<T extends string>(
  expected: T | readonly T[] | undefined,
  actualValues: readonly (T | undefined)[],
): boolean {
  if (expected === undefined) return true;
  return actualValues.some(actual => matchesValue(expected, actual));
}

function matchesNetworkHost(expected: string | readonly string[] | undefined, actual: string | undefined): boolean {
  return matchesValue(normalizeExpectedStringSelector(expected, normalizeNetworkHost), normalizeNetworkHost(actual));
}

function matchesNetworkProtocol(expected: string | readonly string[] | undefined, actual: string | undefined): boolean {
  return matchesValue(
    normalizeExpectedStringSelector(expected, normalizeNetworkProtocol),
    normalizeNetworkProtocol(actual),
  );
}

function normalizeExpectedStringSelector(
  expected: string | readonly string[] | undefined,
  normalize: (value: string | undefined) => string | undefined,
): string | readonly string[] | undefined {
  if (expected === undefined) return undefined;
  if (Array.isArray(expected)) {
    return expected.map(value => normalize(value) ?? value);
  }
  if (typeof expected !== 'string') return expected;
  return normalize(expected) ?? expected;
}

function normalizeNetworkHost(value: string | undefined): string | undefined {
  return value?.toLowerCase();
}

function normalizeNetworkProtocol(value: string | undefined): string | undefined {
  return value?.replace(/:$/, '').toLowerCase();
}

function matchesFileRootSelector(rule: WorkspacePolicyRule, rootIds: readonly (string | undefined)[]): boolean {
  if (rule.rootId === undefined) return true;
  const actualRootIds = rootIds.filter((rootId): rootId is string => rootId !== undefined);
  if (actualRootIds.length === 0) return false;

  // Allow rules must approve every involved root, while deny/ask rules block when any involved root matches.
  if (rule.decision === 'allow') {
    return actualRootIds.every(rootId => matchesValue(rule.rootId, rootId));
  }
  return matchesAnyValue(rule.rootId, actualRootIds);
}

function strongestDecision(decisions: readonly PermissionPolicy[], fallback: PermissionPolicy): PermissionPolicy {
  if (decisions.includes('deny')) return 'deny';
  if (decisions.includes('ask')) return 'ask';
  if (decisions.includes('allow')) return 'allow';
  return fallback;
}

function isMutatingFileOperation(operation: WorkspaceFileOperation): boolean {
  return MUTATING_FILE_OPERATIONS.has(operation);
}
