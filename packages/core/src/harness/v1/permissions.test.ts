import { describe, expect, it, vi } from 'vitest';

import { evaluatePermission, resolveEffectivePolicy } from './permissions';
import { buildSessionToolsets } from './tools';

const executableTool = (execute = vi.fn(async () => ({ ok: true }))) =>
  ({ id: 'tool', description: 'tool', parameters: {} as never, execute }) as never;

const context = { requestContext: undefined, workspace: undefined } as never;

describe('harness v1 permissions', () => {
  it('resolves policy by tool, category, default, then fallback precedence', () => {
    expect(
      resolveEffectivePolicy('shell', 'execute', {
        tools: { shell: 'allow' },
        categories: { execute: 'deny' },
        defaultPolicy: 'ask',
      }),
    ).toEqual({ policy: 'allow', matchedRule: 'tool' });

    expect(resolveEffectivePolicy('read_file', 'read', { categories: { read: { policy: 'deny' } } })).toEqual({
      policy: 'deny',
      matchedRule: 'category',
    });

    expect(resolveEffectivePolicy('unknown', null, { defaultPolicy: 'allow' }, 'deny')).toEqual({
      policy: 'allow',
      matchedRule: 'default',
    });

    expect(resolveEffectivePolicy('unknown', null, undefined, undefined)).toEqual({
      policy: 'ask',
      matchedRule: 'fallback',
    });
  });

  it('treats deny as terminal even with grants and yolo', () => {
    const result = evaluatePermission({
      toolName: 'shell',
      category: 'execute',
      gate: 'pre-action',
      permissionRules: { tools: { shell: 'deny' } },
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
        toolFnRequiresApproval: true,
      }),
    ).toMatchObject({ decision: 'pendingApproval', reasons: ['tool-config', 'tool-fn'] });
  });

  it('filters denied tools at pre-exposure and wraps allowed tools for pre-action', async () => {
    const denied = executableTool();
    const allowedExecute = vi.fn(async () => ({ ok: true }));
    const allowed = executableTool(allowedExecute);

    const tools = buildSessionToolsets({
      agentTools: { denied, allowed },
      permissionRules: { tools: { denied: 'deny', allowed: 'allow' } },
      permissions: { defaultPermissionPolicy: 'ask' },
    }) as Record<string, { execute: (input: unknown, context: never) => Promise<unknown> }>;

    expect(tools.denied).toBeUndefined();
    await expect(tools.allowed!.execute({ value: 1 }, context)).resolves.toEqual({ ok: true });
    expect(allowedExecute).toHaveBeenCalledWith({ value: 1 }, context);
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
