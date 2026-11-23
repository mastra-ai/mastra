import { Container, Text } from '@earendil-works/pi-tui';
import { emitFeatureInstall } from '@mastra/code-sdk/features/events';
import stripAnsi from 'strip-ansi';

import { describe, expect, it, vi } from 'vitest';
import {
  showError,
  showFeatureInstallNotices,
  showFormattedError,
  showInfo,
  showLines,
  showProgress,
} from './display.js';
import type { TUIState } from './state.js';

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

describe('showFeatureInstallNotices', () => {
  const label = 'local embeddings for memory recall';

  it('shows a spinner while local embeddings install on first use, then replaces it with the result', () => {
    const state = createState();
    const stop = showFeatureInstallNotices(state);
    try {
      emitFeatureInstall({
        type: 'feature_install',
        status: 'started',
        feature: 'embeddings',
        label,
        approxSizeMb: 325,
      });
      expect(renderedText(state)).toContain('Installing local embeddings for memory recall (about 325 MB, one time)…');

      emitFeatureInstall({
        type: 'feature_install',
        status: 'completed',
        feature: 'embeddings',
        label,
        durationMs: 12_300,
      });
      expect(renderedText(state)).not.toContain('Installing');
      expect(renderedText(state)).toContain('Installed local embeddings for memory recall in 12.3 s.');
    } finally {
      stop();
    }
  });

  it('tells the user how to get the feature when the install fails offline', () => {
    const state = createState();
    const stop = showFeatureInstallNotices(state);
    try {
      emitFeatureInstall({
        type: 'feature_install',
        status: 'started',
        feature: 'embeddings',
        label,
        approxSizeMb: 325,
      });
      emitFeatureInstall({
        type: 'feature_install',
        status: 'failed',
        feature: 'embeddings',
        label,
        reason: 'network',
        message: 'the npm registry could not be reached (offline, DNS or proxy problem).',
        remedy: 'Run "mastracode features install embeddings" when the npm registry is reachable.',
      });
      const text = renderedText(state);
      expect(text).not.toContain('Installing');
      expect(text).toContain(
        'Error: Local embeddings for memory recall unavailable: the npm registry could not be reached',
      );
      expect(text).toContain('mastracode features install embeddings');
    } finally {
      stop();
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
