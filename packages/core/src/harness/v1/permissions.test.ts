import { describe, expect, it, vi } from 'vitest';

import { evaluatePermission, resolveEffectivePolicy } from './permissions';
import { buildSessionToolsets } from './tools';

const executableTool = (execute = vi.fn(async () => ({ ok: true }))) =>
  ({ id: 'tool', description: 'tool', parameters: {} as never, execute }) as never;

const context = { requestContext: undefined, workspace: undefined } as never;

describe('harness v1 permissions', () => {
  it('resolves policy by tool, category, default, then fallback precedence', () => {
    expect(
      resolveEffectivePolicy('shell', 'execute', [
        { toolName: 'shell', policy: 'allow' },
        { category: 'execute', policy: 'deny' },
        { policy: 'ask' },
      ]),
    ).toEqual({ policy: 'allow', matchedRule: 'tool' });

    expect(resolveEffectivePolicy('read_file', 'read', [{ category: 'read', policy: 'deny' }])).toEqual({
      policy: 'deny',
      matchedRule: 'category',
    });

    expect(resolveEffectivePolicy('unknown', null, [{ policy: 'allow' }], 'deny')).toEqual({
      policy: 'allow',
      matchedRule: 'default',
    });

    expect(resolveEffectivePolicy('unknown', null, undefined, undefined)).toEqual({
      policy: 'ask',
      matchedRule: 'fallback',
    });
  });

  it('applies tool arg regex rules only when args match', () => {
    expect(
      resolveEffectivePolicy(
        'shell',
        'execute',
        [{ toolName: 'shell', policy: 'allow', args: { command: '^ls(?:\\s|$)' } }],
        'ask',
        { command: 'ls -la' },
      ),
    ).toEqual({ policy: 'allow', matchedRule: 'tool' });

    expect(
      resolveEffectivePolicy(
        'shell',
        'execute',
        [{ toolName: 'shell', policy: 'allow', args: { command: '^ls(?:\\s|$)' } }],
        'ask',
        { command: 'rm -rf tmp' },
      ),
    ).toEqual({ policy: 'ask', matchedRule: 'default' });
  });

  it('applies category arg regex rules only when args match', () => {
    expect(
      resolveEffectivePolicy(
        'shell',
        'execute',
        [{ category: 'execute', policy: 'allow', args: { command: '^pwd$' } }],
        'ask',
        { command: 'pwd' },
      ),
    ).toEqual({ policy: 'allow', matchedRule: 'category' });

    expect(
      resolveEffectivePolicy(
        'shell',
        'execute',
        [{ category: 'execute', policy: 'allow', args: { command: '^pwd$' } }],
        'ask',
        { command: 'ls' },
      ),
    ).toEqual({ policy: 'ask', matchedRule: 'default' });
  });

  it('fails closed for invalid arg regex rules', () => {
    expect(
      resolveEffectivePolicy(
        'shell',
        'execute',
        [{ toolName: 'shell', policy: 'allow', args: { command: '[' } }],
        'ask',
        { command: 'ls' },
      ),
    ).toEqual({ policy: 'ask', matchedRule: 'default' });
  });

  it('matches arg-scoped grants without changing broad grants', () => {
    expect(
      evaluatePermission({
        toolName: 'shell',
        category: 'execute',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        args: { command: 'ls -la' },
        sessionGrants: [{ id: 'grant-args', toolName: 'shell', args: { command: '^ls(?:\\s|$)' } }],
      }),
    ).toMatchObject({ decision: 'allow', reasons: [], metadata: { grantId: 'grant-args' } });

    expect(
      evaluatePermission({
        toolName: 'shell',
        category: 'execute',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        args: { command: 'rm -rf tmp' },
        sessionGrants: [{ id: 'grant-args', toolName: 'shell', args: { command: '^ls(?:\\s|$)' } }],
      }),
    ).toMatchObject({ decision: 'pendingApproval', reasons: ['policy'], metadata: { grantId: undefined } });

    expect(
      evaluatePermission({
        toolName: 'shell',
        category: 'execute',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        args: { command: 'rm -rf tmp' },
        sessionGrants: [{ id: 'grant-broad', category: 'execute' }],
      }),
    ).toMatchObject({ decision: 'allow', reasons: [], metadata: { grantId: 'grant-broad' } });
  });

  it('treats deny as terminal even with grants and yolo', () => {
    const result = evaluatePermission({
      toolName: 'shell',
      category: 'execute',
      gate: 'pre-action',
      permissionRules: [{ toolName: 'shell', policy: 'deny' }],
      sessionGrants: [{ id: 'grant-1', toolName: 'shell' }],
      yolo: true,
    });

    expect(result).toMatchObject({
      decision: 'deny',
      policy: 'deny',
      reasons: [],
      metadata: { matchedRule: 'tool', grantId: undefined, yolo: true },
    });
  });

  it('lets grants and yolo suppress only policy-driven approvals', () => {
    expect(
      evaluatePermission({
        toolName: 'edit_file',
        category: 'edit',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        sessionGrants: [{ id: 'grant-1', category: 'edit' }],
      }),
    ).toMatchObject({ decision: 'allow', reasons: [], metadata: { grantId: 'grant-1' } });

    expect(
      evaluatePermission({
        toolName: 'edit_file',
        category: 'edit',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        yolo: true,
      }),
    ).toMatchObject({ decision: 'allow', reasons: [], metadata: { yolo: true } });

    expect(
      evaluatePermission({
        toolName: 'edit_file',
        category: 'edit',
        gate: 'pre-action',
        defaultPermissionPolicy: 'ask',
        sessionGrants: [{ id: 'grant-1', category: 'edit' }],
        toolConfigRequiresApproval: true,
      }),
    ).toMatchObject({ decision: 'pendingApproval', reasons: ['tool-config'] });
  });

  it('filters denied tools at pre-exposure and wraps allowed tools for pre-action', async () => {
    const denied = executableTool();
    const allowedExecute = vi.fn(async () => ({ ok: true }));
    const allowed = executableTool(allowedExecute);

    const tools = buildSessionToolsets({
      agentTools: { denied, allowed },
      permissionRules: [
        { toolName: 'denied', policy: 'deny' },
        { toolName: 'allowed', policy: 'allow' },
      ],
      permissions: { defaultPermissionPolicy: 'ask' },
    }) as Record<string, { execute: (input: unknown, context: never) => Promise<unknown> }>;

    expect(tools.denied).toBeUndefined();
    await expect(tools.allowed!.execute({ value: 1 }, context)).resolves.toEqual({ ok: true });
    expect(allowedExecute).toHaveBeenCalledWith({ value: 1 }, context);
  });

  it('lets allow policies execute tools with dynamic approval callbacks', async () => {
    const onPendingApproval = vi.fn(async () => ({ pendingItemId: 'pending-1', status: 'pending' }));
    const execute = vi.fn(async () => ({ ok: true }));
    const needsApprovalFn = vi.fn(() => true);
    const tool = {
      id: 'tool',
      description: 'tool',
      parameters: {} as never,
      execute,
      needsApprovalFn,
    };

    const tools = buildSessionToolsets({
      agentTools: { tool: tool as never },
      permissionRules: [{ toolName: 'tool', policy: 'allow' }],
      permissions: { defaultPermissionPolicy: 'ask', onPendingApproval },
    }) as Record<string, { execute: (input: unknown, context: never) => Promise<unknown> }>;

    await expect(tools.tool!.execute({ value: 1 }, context)).resolves.toEqual({ ok: true });
    expect(execute).toHaveBeenCalledWith({ value: 1 }, context);
    expect(needsApprovalFn).not.toHaveBeenCalled();
    expect(onPendingApproval).not.toHaveBeenCalled();
  });

  it('creates pending approval results at the pre-action gate', async () => {
    const onPendingApproval = vi.fn(async () => ({ pendingItemId: 'pending-1', status: 'pending' }));
    const tool = executableTool();

    const tools = buildSessionToolsets({
      agentTools: { tool },
      permissions: {
        defaultPermissionPolicy: 'ask',
        onPendingApproval,
      },
    }) as Record<string, { execute: (input: unknown, context: never) => Promise<unknown> }>;

    await expect(tools.tool!.execute({ value: 1 }, context)).resolves.toMatchObject({
      isError: false,
      pendingItemId: 'pending-1',
      status: 'pending',
      permission: {
        decision: 'pendingApproval',
        reasons: ['policy'],
        metadata: { toolName: 'tool', gate: 'pre-action' },
      },
    });
    expect(onPendingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'tool',
        args: { value: 1 },
        result: expect.objectContaining({ decision: 'pendingApproval' }),
      }),
    );
  });
});
