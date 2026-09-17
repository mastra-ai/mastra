/**
 * Durable `toolRequiresApproval`: the per-tool `needsApprovalFn` must receive
 * the same `{ requestContext, workspace }` context the non-durable loop passes
 * (issue #22491). Before the fix it was invoked with only the args, so any
 * predicate that read `ctx.requestContext` threw / returned undefined and the
 * call silently fail-closed to "require approval".
 */

import { describe, expect, it, vi } from 'vitest';
import { toolRequiresApproval } from './resolve-runtime';

function makeTool(needsApprovalFn: (input: any, ctx?: any) => boolean | Promise<boolean>) {
  return { id: 'tool', description: 'tool', needsApprovalFn } as any;
}

describe('toolRequiresApproval — needsApprovalFn context forwarding', () => {
  it('passes { requestContext, workspace } as the second argument', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    const workspace = { id: 'ws-1' } as any;
    const requestContext = { channel: { platform: 'imessage' }, tenant: 'acme' };

    await toolRequiresApproval(
      makeTool(needsApprovalFn),
      false,
      { x: 1 },
      { toolName: 'tool', requestContext, workspace },
    );

    expect(needsApprovalFn).toHaveBeenCalledTimes(1);
    expect(needsApprovalFn).toHaveBeenCalledWith({ x: 1 }, { requestContext, workspace });
  });

  it('lets a context-dependent predicate decide (reporter scenario)', async () => {
    const tool = makeTool((_input, ctx) => (ctx?.requestContext as any)?.channel?.platform !== 'imessage');

    await expect(
      toolRequiresApproval(
        tool,
        false,
        {},
        { toolName: 'tool', requestContext: { channel: { platform: 'imessage' } } },
      ),
    ).resolves.toBe(false);

    await expect(
      toolRequiresApproval(tool, false, {}, { toolName: 'tool', requestContext: { channel: { platform: 'web' } } }),
    ).resolves.toBe(true);
  });

  it('still fails closed when the predicate throws', async () => {
    const tool = makeTool(() => {
      throw new Error('boom');
    });
    await expect(toolRequiresApproval(tool, false, {}, { toolName: 'tool', requestContext: {} })).resolves.toBe(true);
  });

  it('passes an empty context object when no approvalContext is supplied', async () => {
    const needsApprovalFn = vi.fn().mockReturnValue(false);
    await toolRequiresApproval(makeTool(needsApprovalFn), false, { a: 1 });
    expect(needsApprovalFn).toHaveBeenCalledWith({ a: 1 }, { requestContext: undefined, workspace: undefined });
  });
});
