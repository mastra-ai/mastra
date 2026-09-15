import { describe, expect, it, vi } from 'vitest';
import { handleNameCommand } from '../name.js';

describe('handleNameCommand', () => {
  it('renames the active thread', async () => {
    const rename = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      state: { session: { thread: { getId: vi.fn(() => 'thread-1'), rename } } },
      showInfo: vi.fn(),
    } as any;

    await handleNameCommand(ctx, ['Demo', 'thread']);

    expect(rename).toHaveBeenCalledWith({ title: 'Demo thread' });
    expect(ctx.showInfo).toHaveBeenCalledWith('Thread renamed to: Demo thread');
  });

  it('shows /rename usage when the title is empty', async () => {
    const ctx = { showInfo: vi.fn() } as any;

    await handleNameCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith('Usage: /rename <title>');
  });

  it('does not save a title before the first prompt creates a thread', async () => {
    const rename = vi.fn();
    const ctx = {
      state: { session: { thread: { getId: vi.fn(() => null), rename } } },
      showInfo: vi.fn(),
    } as any;

    await handleNameCommand(ctx, ['Unsaved']);

    expect(rename).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith('No active thread. Send a message first.');
  });
});
