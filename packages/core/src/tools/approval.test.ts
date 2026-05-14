import { describe, expect, it, vi } from 'vitest';
import { resolveToolRequiresApproval } from './approval';

describe('resolveToolRequiresApproval', () => {
  it('treats static requireApproval as an approval floor', async () => {
    await expect(
      resolveToolRequiresApproval({
        tool: {
          requireApproval: true,
          needsApprovalFn: vi.fn().mockReturnValue(false),
        },
        args: { path: '/tmp/file.txt' },
      }),
    ).resolves.toBe(true);
  });

  it('treats global requireToolApproval as an approval floor', async () => {
    await expect(
      resolveToolRequiresApproval({
        tool: {
          requireApproval: false,
          needsApprovalFn: vi.fn().mockReturnValue(false),
        },
        requireToolApproval: true,
        args: { path: '/tmp/file.txt' },
      }),
    ).resolves.toBe(true);
  });

  it('lets dynamic-only approval skip safe calls', async () => {
    await expect(
      resolveToolRequiresApproval({
        tool: {
          requireApproval: false,
          needsApprovalFn: vi.fn().mockReturnValue(false),
        },
        args: { path: '/tmp/file.txt' },
      }),
    ).resolves.toBe(false);
  });

  it('supports raw tools with function-valued requireApproval', async () => {
    await expect(
      resolveToolRequiresApproval({
        tool: {
          requireApproval: vi.fn().mockReturnValue(true),
        },
        args: { path: '/protected/file.txt' },
      }),
    ).resolves.toBe(true);
  });

  it('supports raw AI SDK needsApproval callbacks', async () => {
    await expect(
      resolveToolRequiresApproval({
        tool: {
          needsApproval: vi.fn().mockReturnValue(true),
        },
        args: { path: '/protected/file.txt' },
      }),
    ).resolves.toBe(true);
  });

  it('passes request context and workspace to dynamic approval functions', async () => {
    const workspace = { id: 'workspace' };
    const needsApprovalFn = vi.fn().mockReturnValue(true);

    await resolveToolRequiresApproval({
      tool: { needsApprovalFn },
      args: { path: '/tmp/file.txt' },
      requestContext: new Map([['userId', 'user-1']]),
      workspace,
    });

    expect(needsApprovalFn).toHaveBeenCalledWith(
      { path: '/tmp/file.txt' },
      {
        requestContext: { userId: 'user-1' },
        workspace,
      },
    );
  });

  it('requires approval when the dynamic approval function throws', async () => {
    const logger = { error: vi.fn() };

    await expect(
      resolveToolRequiresApproval({
        tool: {
          needsApprovalFn: vi.fn().mockImplementation(() => {
            throw new Error('boom');
          }),
        },
        logger,
        toolName: 'dangerous-tool',
      }),
    ).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('dangerous-tool'), expect.any(Error));
  });
});
