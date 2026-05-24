import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateWorkspacePolicy, resolveWorkspacePath } from './policy';
import type { WorkspacePolicy } from './policy';

const roots = [
  { id: 'project', path: '/workspace/project', writable: true },
  { id: 'nested', path: '/workspace/project/packages/app', writable: true },
  { id: 'readonly', path: '/workspace/docs', writable: false },
  { id: 'scratch', path: '/workspace/scratch', writable: true },
] satisfies WorkspacePolicy['roots'];

describe('workspace policy evaluator', () => {
  it('resolves paths against the most specific workspace root', () => {
    const resolved = resolveWorkspacePath(roots, '/workspace/project/packages/app/src/index.ts');

    expect(resolved).toMatchObject({
      root: { id: 'nested', path: '/workspace/project/packages/app' },
      normalizedPath: '/workspace/project/packages/app/src/index.ts',
      relativePath: 'src/index.ts',
    });
  });

  it('resolves Windows-style absolute paths against workspace roots', () => {
    const windowsRoots = [
      { id: 'project', path: 'C:\\workspace\\project', writable: true },
    ] satisfies WorkspacePolicy['roots'];

    expect(resolveWorkspacePath(windowsRoots, 'C:\\workspace\\project\\src\\index.ts')).toMatchObject({
      root: { id: 'project', path: 'C:\\workspace\\project' },
      normalizedPath: 'C:\\workspace\\project\\src\\index.ts',
      relativePath: 'src\\index.ts',
    });
  });

  it('denies traversal outside an explicit workspace root', () => {
    const evaluation = evaluateWorkspacePolicy(
      { roots, defaultDecision: 'allow' },
      { kind: 'file', operation: 'read', path: '../secret.txt', rootId: 'project' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.path_outside_roots'],
    });
  });

  it('denies Windows-style traversal outside an explicit workspace root', () => {
    const windowsRoots = [
      { id: 'project', path: 'C:\\workspace\\project', writable: true },
    ] satisfies WorkspacePolicy['roots'];

    const evaluation = evaluateWorkspacePolicy(
      { roots: windowsRoots, defaultDecision: 'allow' },
      { kind: 'file', operation: 'read', path: '..\\secret.txt', rootId: 'project' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.path_outside_roots'],
    });
  });

  it('keeps backslashes as literal path characters for POSIX roots', () => {
    const resolved = resolveWorkspacePath(roots, '..\\secret.txt', 'project');

    expect(resolved).toMatchObject({
      root: { id: 'project' },
      normalizedPath: '/workspace/project/..\\secret.txt',
      relativePath: '..\\secret.txt',
    });
  });

  it('keeps lexical path containment segment-aware', () => {
    const resolved = resolveWorkspacePath(
      [{ id: 'project', path: '/workspace/project' }],
      '..files/cache.txt',
      'project',
    );

    expect(resolved).toMatchObject({
      normalizedPath: '/workspace/project/..files/cache.txt',
      relativePath: '..files/cache.txt',
    });
  });

  it('denies file moves whose target leaves the selected root', () => {
    const evaluation = evaluateWorkspacePolicy(
      { roots, defaultDecision: 'allow' },
      {
        kind: 'file',
        operation: 'rename',
        path: 'src/index.ts',
        toPath: '../other/index.ts',
        rootId: 'project',
      },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.target_path_outside_roots'],
    });
  });

  it('denies rename actions that omit the target path', () => {
    const evaluation = evaluateWorkspacePolicy(
      { roots, defaultDecision: 'allow' },
      { kind: 'file', operation: 'rename', path: 'src/index.ts', rootId: 'project' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.target_path_required'],
    });
  });

  it('denies mutating operations inside read-only roots before rules are applied', () => {
    const evaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'ask',
        rules: [{ id: 'allow-docs', kind: 'file', rootId: 'readonly', operation: 'write', decision: 'allow' }],
      },
      { kind: 'file', operation: 'write', path: 'notes.md', rootId: 'readonly' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.root_readonly:readonly'],
      path: { root: { id: 'readonly' }, normalizedPath: '/workspace/docs/notes.md' },
    });
  });

  it('treats roots as writable when writable is omitted', () => {
    const implicitWritableRoots = [
      { id: 'project', path: '/workspace/project' },
      { id: 'scratch', path: '/workspace/scratch' },
    ] satisfies WorkspacePolicy['roots'];

    const writeEvaluation = evaluateWorkspacePolicy(
      { roots: implicitWritableRoots, defaultDecision: 'allow' },
      { kind: 'file', operation: 'write', path: 'src/index.ts', rootId: 'project' },
    );
    const renameEvaluation = evaluateWorkspacePolicy(
      { roots: implicitWritableRoots, defaultDecision: 'allow' },
      {
        kind: 'file',
        operation: 'rename',
        path: '/workspace/project/src/index.ts',
        toPath: '/workspace/scratch/index.ts',
      },
    );

    expect(writeEvaluation).toMatchObject({
      decision: 'allow',
      reasons: ['workspace.default_allow'],
      path: { root: { id: 'project' } },
    });
    expect(renameEvaluation).toMatchObject({
      decision: 'allow',
      reasons: ['workspace.default_allow'],
      path: { root: { id: 'project' } },
      toPath: { root: { id: 'scratch' } },
    });
  });

  it('preserves an explicitly selected root id when another root shares the same path', () => {
    const duplicatePathRoots = [
      { id: 'writable', path: '/workspace/project', writable: true },
      { id: 'readonly', path: '/workspace/project', writable: false },
    ] satisfies WorkspacePolicy['roots'];

    const evaluation = evaluateWorkspacePolicy(
      { roots: duplicatePathRoots, defaultDecision: 'allow' },
      { kind: 'file', operation: 'write', path: 'notes.md', rootId: 'readonly' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.root_readonly:readonly'],
      path: { root: { id: 'readonly' } },
    });
  });

  it('enforces the most specific root even when callers provide a broader root id', () => {
    const evaluation = evaluateWorkspacePolicy(
      {
        roots: [
          { id: 'project', path: '/workspace/project', writable: true },
          { id: 'generated', path: '/workspace/project/generated', writable: false },
        ],
        defaultDecision: 'allow',
      },
      { kind: 'file', operation: 'write', path: 'generated/index.ts', rootId: 'project' },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.root_readonly:generated'],
      path: { root: { id: 'generated' }, normalizedPath: '/workspace/project/generated/index.ts' },
    });
  });

  it('uses deny over ask and allow when multiple rules match', () => {
    const evaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'allow',
        rules: [
          { id: 'allow-project', kind: 'file', rootId: 'project', operation: 'write', decision: 'allow' },
          { id: 'ask-write', kind: 'file', operation: 'write', decision: 'ask' },
          { id: 'deny-lock', kind: 'file', rootId: 'project', operation: 'write', decision: 'deny' },
        ],
      },
      { kind: 'file', operation: 'write', path: 'src/index.ts', rootId: 'project' },
    );

    expect(evaluation.decision).toBe('deny');
    expect(evaluation.matchedRules.map(rule => rule.id)).toEqual(['allow-project', 'ask-write', 'deny-lock']);
  });

  it('applies file root rules to rename targets as well as sources', () => {
    const evaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'deny',
        rules: [
          { id: 'allow-project-rename', kind: 'file', rootId: 'project', operation: 'rename', decision: 'allow' },
          { id: 'deny-scratch-rename', kind: 'file', rootId: 'scratch', operation: 'rename', decision: 'deny' },
        ],
      },
      {
        kind: 'file',
        operation: 'rename',
        path: '/workspace/project/src/index.ts',
        toPath: '/workspace/scratch/index.ts',
      },
    );

    expect(evaluation.decision).toBe('deny');
    expect(evaluation.matchedRules.map(rule => rule.id)).toEqual(['deny-scratch-rename']);
    expect(evaluation).toMatchObject({
      path: { root: { id: 'project' } },
      toPath: { root: { id: 'scratch' } },
    });
  });

  it('does not let a source-root allow authorize an unallowed rename target root', () => {
    const evaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'deny',
        rules: [
          { id: 'allow-project-rename', kind: 'file', rootId: 'project', operation: 'rename', decision: 'allow' },
        ],
      },
      {
        kind: 'file',
        operation: 'rename',
        path: '/workspace/project/src/index.ts',
        toPath: '/workspace/scratch/index.ts',
      },
    );

    expect(evaluation).toMatchObject({
      decision: 'deny',
      matchedRules: [],
      reasons: ['workspace.default_deny'],
    });
  });

  it('uses ask over allow and falls back to the default decision when no rules match', () => {
    const askEvaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'deny',
        rules: [
          { id: 'allow-project', kind: 'file', rootId: 'project', operation: 'read', decision: 'allow' },
          { id: 'ask-project', kind: 'file', rootId: 'project', operation: 'read', decision: 'ask' },
        ],
      },
      { kind: 'file', operation: 'read', path: 'README.md', rootId: 'project' },
    );

    expect(askEvaluation.decision).toBe('ask');

    const defaultEvaluation = evaluateWorkspacePolicy(
      {
        roots,
        defaultDecision: 'deny',
        rules: [{ id: 'allow-command', kind: 'command', command: 'pnpm', decision: 'allow' }],
      },
      { kind: 'network', host: 'example.com', protocol: 'https' },
    );

    expect(defaultEvaluation).toMatchObject({
      decision: 'deny',
      matchedRules: [],
      reasons: ['workspace.default_deny'],
    });
  });

  it('matches command, network, and MCP selectors only on their own action kinds', () => {
    const policy: WorkspacePolicy = {
      roots,
      defaultDecision: 'deny',
      rules: [
        { id: 'pnpm', kind: 'command', command: 'pnpm', decision: 'allow' },
        {
          id: 'api',
          kind: 'network',
          networkHost: ['api.example.test'],
          networkPort: 443,
          networkProtocol: 'https',
          decision: 'ask',
        },
        { id: 'linear', kind: 'mcp', mcpServerId: 'linear', mcpToolName: 'createComment', decision: 'allow' },
        { id: 'bad-cross-kind', kind: 'command', mcpServerId: 'linear', decision: 'allow' },
      ],
    };

    expect(evaluateWorkspacePolicy(policy, { kind: 'command', command: 'pnpm', args: ['test'] })).toMatchObject({
      decision: 'allow',
      matchedRules: [{ id: 'pnpm' }],
    });
    expect(
      evaluateWorkspacePolicy(policy, { kind: 'network', host: 'API.EXAMPLE.TEST', port: 443, protocol: 'https:' }),
    ).toMatchObject({
      decision: 'ask',
      matchedRules: [{ id: 'api' }],
    });
    expect(
      evaluateWorkspacePolicy(policy, { kind: 'network', host: 'api.example.test', port: 80, protocol: 'http' }),
    ).toMatchObject({
      decision: 'deny',
      matchedRules: [],
    });
    expect(
      evaluateWorkspacePolicy(policy, { kind: 'mcp', serverId: 'linear', toolName: 'createComment' }),
    ).toMatchObject({
      decision: 'allow',
      matchedRules: [{ id: 'linear' }],
    });
    expect(
      evaluateWorkspacePolicy(policy, { kind: 'mcp', serverId: 'linear', toolName: 'archiveIssue' }),
    ).toMatchObject({
      decision: 'deny',
      matchedRules: [],
    });
  });

  it('denies paths that escape a workspace root through an existing symlink', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mastra-workspace-policy-'));
    const rootDir = path.join(tempDir, 'root');
    const outsideDir = path.join(tempDir, 'outside');

    try {
      fs.mkdirSync(rootDir);
      fs.mkdirSync(outsideDir);
      fs.symlinkSync(outsideDir, path.join(rootDir, 'linked-outside'), 'dir');

      const evaluation = evaluateWorkspacePolicy(
        { roots: [{ id: 'project', path: rootDir, writable: true }], defaultDecision: 'allow' },
        { kind: 'file', operation: 'write', path: 'linked-outside/created.txt', rootId: 'project' },
      );

      expect(evaluation).toMatchObject({
        decision: 'deny',
        reasons: ['workspace.path_outside_roots'],
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('contains command cwd and lets command rules target the cwd root', () => {
    const policy: WorkspacePolicy = {
      roots,
      defaultDecision: 'deny',
      rules: [{ id: 'pnpm-project', kind: 'command', rootId: 'project', command: 'pnpm', decision: 'allow' }],
    };

    expect(
      evaluateWorkspacePolicy(policy, { kind: 'command', command: 'pnpm', cwd: '/workspace/project', args: ['test'] }),
    ).toMatchObject({
      decision: 'allow',
      matchedRules: [{ id: 'pnpm-project' }],
      cwd: { root: { id: 'project' }, normalizedPath: '/workspace/project' },
    });
    expect(
      evaluateWorkspacePolicy(
        {
          roots,
          defaultDecision: 'allow',
          rules: [{ id: 'pnpm', kind: 'command', command: 'pnpm', decision: 'allow' }],
        },
        { kind: 'command', command: 'pnpm', cwd: '/etc' },
      ),
    ).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.cwd_outside_roots'],
    });
  });

  it('lets command rootId select a workspace root without a cwd', () => {
    const policy: WorkspacePolicy = {
      roots,
      defaultDecision: 'deny',
      rules: [{ id: 'pnpm-project', kind: 'command', rootId: 'project', command: 'pnpm', decision: 'allow' }],
    };

    expect(evaluateWorkspacePolicy(policy, { kind: 'command', command: 'pnpm', rootId: 'project' })).toMatchObject({
      decision: 'allow',
      matchedRules: [{ id: 'pnpm-project' }],
    });
    expect(evaluateWorkspacePolicy(policy, { kind: 'command', command: 'pnpm', rootId: 'missing' })).toMatchObject({
      decision: 'deny',
      reasons: ['workspace.root_not_found'],
    });
  });
});
