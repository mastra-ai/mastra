import { Container } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import { showError, showFormattedError, showInfo } from './display.js';
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
});

describe('display message ordering', () => {
  it.each(['activeInlineQuestion', 'activeInlinePlanApproval'] as const)(
    'keeps %s at the end of the chat while background messages arrive',
    activePromptKey => {
      const state = createState();
      const activePrompt = new Container();
      state.chatContainer.addChild(activePrompt);
      (state as unknown as Record<string, unknown>)[activePromptKey] = activePrompt;

      showInfo(state, 'Background info');
      showError(state, 'Background failure');
      showFormattedError(state, new Error('Formatted background failure'));

      expect(state.chatContainer.children.at(-1)).toBe(activePrompt);
      expect(renderedText(state)).toContain('Background info');
      expect(renderedText(state)).toContain('Background failure');
      expect(renderedText(state)).toContain('Formatted background failure');
    },
  );
});
