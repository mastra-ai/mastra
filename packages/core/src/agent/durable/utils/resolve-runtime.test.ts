import { describe, expect, it, vi } from 'vitest';
import { toolRequiresApproval } from './resolve-runtime';

describe('durable tool approval resolution', () => {
  it('does not let needsApprovalFn downgrade global approval', async () => {
    const tool = {
      needsApprovalFn: vi.fn().mockReturnValue(false),
    } as any;

    await expect(toolRequiresApproval(tool, true, { action: 'send' })).resolves.toBe(true);
    expect(tool.needsApprovalFn).toHaveBeenCalledWith({ action: 'send' });
  });

  it('does not let needsApprovalFn downgrade tool-owned approval', async () => {
    const tool = {
      requireApproval: true,
      needsApprovalFn: vi.fn().mockReturnValue(false),
    } as any;

    await expect(toolRequiresApproval(tool, false, { action: 'send' })).resolves.toBe(true);
  });

  it('allows needsApprovalFn to raise approval when no other source requires it', async () => {
    const tool = {
      needsApprovalFn: vi.fn().mockReturnValue(true),
    } as any;

    await expect(toolRequiresApproval(tool, false, { action: 'delete' })).resolves.toBe(true);
  });

  it('does not require approval when all approval sources are false', async () => {
    const tool = {
      requireApproval: false,
      needsApprovalFn: vi.fn().mockReturnValue(false),
    } as any;

    await expect(toolRequiresApproval(tool, false, { action: 'read' })).resolves.toBe(false);
  });
});
