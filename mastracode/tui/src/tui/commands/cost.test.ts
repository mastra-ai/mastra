import { describe, expect, it, vi } from 'vitest';

import { handleCostCommand } from './cost.js';
import type { SlashCommandContext } from './types.js';

function createContext(tokenUsage: { promptTokens?: number; completionTokens?: number; totalTokens?: number }): {
  ctx: SlashCommandContext;
  showInfo: ReturnType<typeof vi.fn>;
} {
  const showInfo = vi.fn();
  const ctx = {
    state: {
      session: {
        displayState: {
          get: () => ({
            tokenUsage,
            omProgress: { observationTokens: 0 },
          }),
        },
      },
    },
    showInfo,
  } as unknown as SlashCommandContext;
  return { ctx, showInfo };
}

describe('handleCostCommand', () => {
  it('renders unknown primary counts instead of zero', () => {
    const { ctx, showInfo } = createContext({});

    handleCostCommand(ctx);

    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Input:      unknown tokens'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Output:     unknown tokens'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Total:      unknown tokens'));
  });

  it('keeps a measured zero distinct from unknown', () => {
    const { ctx, showInfo } = createContext({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

    handleCostCommand(ctx);

    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Input:      0 tokens'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Output:     0 tokens'));
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('Total:      0 tokens'));
  });
});
