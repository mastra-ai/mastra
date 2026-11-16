import { Container, Text } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { showError, showFormattedError, showInfo, showLines, showProgress } from './display.js';
import type { TUIState } from './state.js';

vi.mock('@mastra/code-sdk/onboarding/settings', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/code-sdk/onboarding/settings')>()),
  loadSettings: () => ({ memoryGateway: { baseUrl: 'https://gateway.example.test' } }),
}));

function createState(): TUIState {
  return {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
    session: {
      om: {
        observer: { modelId: vi.fn(() => undefined) },
        reflector: { modelId: vi.fn(() => undefined) },
      },
    },
  } as unknown as TUIState;
}

function renderedText(state: TUIState): string {
  return stripAnsi(state.chatContainer.render(120).join('\n'));
}

describe('showProgress', () => {
  it('spins with elapsed seconds and removes itself when stopped', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let now = 10_000;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const state = createState();
      showInfo(state, 'Before');

      const stop = showProgress(state, 'Installing with pnpm');
      expect(renderedText(state)).toMatch(/⠋ Installing with pnpm {2}0s/);

      now += 1_000;
      vi.advanceTimersByTime(80);
      expect(renderedText(state)).toContain('Installing with pnpm  1s');

      stop();
      vi.advanceTimersByTime(1_000);
      expect(renderedText(state)).not.toContain('Installing');
      expect(renderedText(state)).toContain('Before');
    } finally {
      nowSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('showLines', () => {
  it('keeps the colors it is given instead of muting the whole message', () => {
    const state = createState();

    showLines(state, ['\x1b[32m✓\x1b[39m Up to date', 'second line']);

    const raw = state.chatContainer.render(120).join('\n');
    expect(raw).toContain('\x1b[32m✓\x1b[39m Up to date');
    expect(renderedText(state)).toContain('second line');
  });
});

describe('showFormattedError', () => {
  it('does not show retry timing when no retry was scheduled', () => {
    const state = createState();

    showFormattedError(state, new Error('Server error. The API may be experiencing issues.'));

    expect(renderedText(state)).toContain('Server error. The API may be experiencing issues.');
    expect(renderedText(state)).not.toContain('retry in 5s');
  });

  it('shows retry timing when the event explicitly schedules a retry', () => {
    const state = createState();

    showFormattedError(state, {
      error: new Error('Server error. The API may be experiencing issues.'),
      retryable: true,
      retryDelay: 500,
      retryAttempt: 1,
      maxRetries: 10,
    });

    expect(renderedText(state)).toContain('retry 1/10 in 0.5s');
  });

  it('shows the provider safety wording and a likely cause for content-filter errors', () => {
    const state = createState();

    showFormattedError(state, new Error('Your request was rejected as a result of our safety system.'));

    const text = renderedText(state);
    expect(text).toContain('safety system blocked this request');
    expect(text).toContain('rejected as a result of our safety system');
    expect(text).toContain('Hint: Retry, rephrase, or use /model to switch models');
  });

  function apiError(status: number, url: string, code: string) {
    return Object.assign(new Error(code), {
      statusCode: status,
      url,
      responseBody: JSON.stringify({ error: { type: 'gateway_error', code, message: code } }),
    });
  }

  it('points a gateway credit refusal at Mastra billing instead of the provider account', () => {
    const state = createState();

    showFormattedError(
      state,
      apiError(402, 'https://gateway.example.test/v1/chat/completions', 'organization_budget_insufficient'),
    );

    const text = renderedText(state);
    expect(text).toContain('The Mastra Gateway refused this request because of your credits or a budget.');
    expect(text).toContain('organization_budget_insufficient');
    expect(text).toContain('Mastra billing');
    expect(text).not.toContain('provider account');
  });

  it('suggests another model for a gateway policy refusal instead of /connect', () => {
    const state = createState();

    showFormattedError(state, apiError(403, 'https://gateway.example.test/v1/chat/completions', 'no_eligible_route'));

    const text = renderedText(state);
    expect(text).toContain('does not allow this model or feature for your key');
    expect(text).toContain('Hint: Use /models to choose another model');
    expect(text).not.toContain('/connect');
  });

  it('keeps the /connect hint for a provider 403', () => {
    const state = createState();

    showFormattedError(state, apiError(403, 'https://api.anthropic.com/v1/messages', 'permission_error'));

    expect(renderedText(state)).toContain('Hint: Use /connect to authenticate with a provider');
  });
});

/** Minimal chat child standing in for an inline prompt component (#21966). */
class FakePromptComponent extends Container {
  constructor() {
    super();
    this.addChild(new Text('PROMPT', 1, 0));
  }

  getChatSpacingKind(): string {
    return 'system';
  }
}

function lastNonSpacerChild(state: TUIState): unknown {
  const children = state.chatContainer.children as unknown[];
  for (let i = children.length - 1; i >= 0; i--) {
    const child = children[i] as { getChatSpacingKind?: () => string };
    if (typeof child.getChatSpacingKind === 'function') return child;
  }
  return undefined;
}

describe('insertion while an inline prompt is active (#21966)', () => {
  it('showInfo inserts above the active inline question, keeping the prompt last', () => {
    const state = createState();
    const prompt = new FakePromptComponent();
    state.chatContainer.addChild(prompt);
    (state as { activeInlineQuestion?: unknown }).activeInlineQuestion = prompt;

    showInfo(state, 'MCP: server "foo" failed to connect');
    showInfo(state, 'MCP: server "bar" needs authentication');

    expect(lastNonSpacerChild(state)).toBe(prompt);
    const text = renderedText(state);
    expect(text.indexOf('failed to connect')).toBeLessThan(text.indexOf('PROMPT'));
    expect(text.indexOf('needs authentication')).toBeLessThan(text.indexOf('PROMPT'));
  });

  it('showError inserts above an active inline plan approval, keeping the prompt last', () => {
    const state = createState();
    const prompt = new FakePromptComponent();
    state.chatContainer.addChild(prompt);
    (state as { activeInlinePlanApproval?: unknown }).activeInlinePlanApproval = prompt;

    showError(state, 'something broke');

    expect(lastNonSpacerChild(state)).toBe(prompt);
  });

  it('showFormattedError inserts above the active inline question', () => {
    const state = createState();
    const prompt = new FakePromptComponent();
    state.chatContainer.addChild(prompt);
    (state as { activeInlineQuestion?: unknown }).activeInlineQuestion = prompt;

    showFormattedError(state, new Error('boom'));

    expect(lastNonSpacerChild(state)).toBe(prompt);
  });

  it('appends at the tail when no prompt is active', () => {
    const state = createState();
    const existing = new FakePromptComponent();
    state.chatContainer.addChild(existing);

    showInfo(state, 'plain info');

    expect(lastNonSpacerChild(state)).not.toBe(existing);
    const text = renderedText(state);
    expect(text.indexOf('PROMPT')).toBeLessThan(text.indexOf('plain info'));
  });
});
