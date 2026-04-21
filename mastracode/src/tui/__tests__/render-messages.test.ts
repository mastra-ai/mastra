import { Container } from '@mariozechner/pi-tui';
import stripAnsi from 'strip-ansi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OMMarkerComponent } from '../components/om-marker.js';
import { OMOutputComponent } from '../components/om-output.js';
import { renderExistingMessages } from '../render-messages.js';
import type { TUIState } from '../state.js';

vi.mock('chalk', () => {
  const makeChain = (): any =>
    new Proxy((value: string) => value, {
      get: (_target, prop) => {
        if (prop === 'call' || prop === 'apply' || prop === 'bind') return Reflect.get(_target, prop);
        if (['hex', 'bgHex', 'rgb', 'bgRgb'].includes(prop as string)) return () => makeChain();
        return makeChain();
      },
    });

  return { default: makeChain() };
});

vi.mock('../theme.js', () => ({
  BOX_INDENT: 0,
  getTermWidth: () => 80,
  getMarkdownTheme: () => ({}),
  mastra: {
    orange: '#f59e0b',
    red: '#ef4444',
    green: '#22c55e',
    specialGray: '#9ca3af',
    mainGray: '#6b7280',
    muted: '#6b7280',
  },
  theme: {
    fg: (_tone: string, value: string) => value,
    bold: (value: string) => value,
  },
}));

describe('renderExistingMessages OM activation history', () => {
  let state: TUIState;
  let listMessages: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listMessages = vi.fn();
    state = {
      chatContainer: new Container(),
      pendingTools: new Map(),
      allToolComponents: [],
      allSlashCommandComponents: [],
      allSystemReminderComponents: [],
      allShellComponents: [],
      followUpComponents: [],
      pendingSubagents: new Map(),
      seenToolCallIds: new Set(),
      subagentToolCallIds: new Set(),
      ui: { requestRender: vi.fn() },
      harness: {
        listMessages,
        getDisplayState: () => ({ isRunning: false }),
      },
      hideThinkingBlock: false,
      toolOutputExpanded: false,
      quietMode: false,
      taskProgress: undefined,
    } as unknown as TUIState;
  });

  it('rehydrates TTL-triggered observation activation with a separate concise history output', async () => {
    listMessages.mockResolvedValue([
      {
        id: 'msg-1',
        role: 'assistant',
        content: [
          {
            type: 'om_activation',
            operationType: 'observation',
            tokensActivated: 7300,
            observationTokens: 400,
            triggeredBy: 'ttl',
            activateAfterIdle: 300_000,
            ttlExpiredMs: 66_000_000,
          },
          {
            type: 'om_concise_history',
            operationType: 'observation',
            conciseHistory: '**user (2026-04-21 10:00:00Z) [m1]:**\n  [p0] hello',
          },
        ],
      },
    ]);

    await renderExistingMessages(state);

    expect(state.chatContainer.children).toHaveLength(3);
    expect(state.chatContainer.children[0]).toBeInstanceOf(OMMarkerComponent);
    expect(state.chatContainer.children[1]).toBeInstanceOf(OMMarkerComponent);
    expect(state.chatContainer.children[2]).toBeInstanceOf(OMOutputComponent);

    const ttlMarker = stripAnsi(state.chatContainer.children[0]!.render(80).join('\n')).replace(/\s+/g, ' ');
    const activationMarker = stripAnsi(state.chatContainer.children[1]!.render(80).join('\n')).replace(/\s+/g, ' ');
    const conciseHistoryBox = stripAnsi(state.chatContainer.children[2]!.render(80).join('\n')).replace(/\s+/g, ' ');

    expect(ttlMarker).toContain('Idle timeout (5m) exceeded by 18h20m, activating observations');
    expect(activationMarker).toContain('Activated observations: -7.3k msg tokens, +0.4k obs tokens');
    expect(conciseHistoryBox).toContain('Activated concise history');
    expect(conciseHistoryBox).toContain('[p0] hello');
  });

  it('rehydrates provider-change reflection activation without concise history output', async () => {
    listMessages.mockResolvedValue([
      {
        id: 'msg-2',
        role: 'assistant',
        content: [
          {
            type: 'om_activation',
            operationType: 'reflection',
            tokensActivated: 19_340,
            observationTokens: 17_077,
            triggeredBy: 'provider_change',
            previousModel: 'openai/gpt-4o',
            currentModel: 'anthropic/claude-3-7-sonnet',
          },
        ],
      },
    ]);

    await renderExistingMessages(state);

    expect(state.chatContainer.children).toHaveLength(2);
    expect(state.chatContainer.children[0]).toBeInstanceOf(OMMarkerComponent);
    expect(state.chatContainer.children[1]).toBeInstanceOf(OMMarkerComponent);

    const providerChangeMarker = stripAnsi(state.chatContainer.children[0]!.render(80).join('\n')).replace(
      /\s+/g,
      ' ',
    );
    const activationMarker = stripAnsi(state.chatContainer.children[1]!.render(80).join('\n')).replace(/\s+/g, ' ');

    expect(providerChangeMarker).toContain(
      'Model changed openai/gpt-4o → anthropic/claude-3-7-sonnet, activating observations',
    );
    expect(activationMarker).toContain('Activated reflection: 19.3k → 17.1k obs tokens (-2.3k)');
  });
});
