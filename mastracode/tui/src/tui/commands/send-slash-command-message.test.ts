import { Container } from '@earendil-works/pi-tui';
import { SessionStartupCancelledError } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';
import { sendSlashCommandMessage } from './send-slash-command-message.js';
import type { SlashCommandContext } from './types.js';

describe('slash command startup failures', () => {
  it.each([false, true])('handles cancellation when active=%s while preserving transport failures', async active => {
    const dispatch = vi.fn().mockRejectedValueOnce(new SessionStartupCancelledError());
    const ctx = {
      state: {
        session: {
          stream: { isActive: () => active },
          sendMessage: dispatch,
          sendSignal: () => ({ id: 'signal', accepted: dispatch() }),
        },
        chatContainer: new Container(),
        pendingSignalMessageComponentsById: new Map(),
        messageComponentsById: new Map(),
        followUpComponents: [],
        ui: { requestRender: vi.fn() },
      },
      addUserMessage: vi.fn(),
      showInfo: vi.fn(),
    } as unknown as SlashCommandContext;

    await expect(sendSlashCommandMessage(ctx, '/review', 'Review my changes')).resolves.toBeUndefined();
    expect(ctx.showInfo).toHaveBeenCalledWith('Interrupted');
    expect(ctx.state.pendingSignalMessageComponentsById.size).toBe(0);

    const transportError = new DOMException('MCP transport aborted', 'AbortError');
    dispatch.mockRejectedValueOnce(transportError);
    await expect(sendSlashCommandMessage(ctx, '/review', 'Review my changes')).rejects.toBe(transportError);
    expect(ctx.state.pendingSignalMessageComponentsById.size).toBe(0);
  });
});
