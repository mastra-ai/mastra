import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  showModalOverlay: vi.fn(),
  lastDialog: undefined as
    | {
        focused: boolean;
        options: {
          question: string;
          onSubmit: (answer: string) => void;
          onCancel: () => void;
        };
      }
    | undefined,
}));

vi.mock('../overlay.js', () => ({
  showModalOverlay: mocks.showModalOverlay,
}));

vi.mock('../components/ask-question-dialog.js', () => {
  class MockAskQuestionDialogComponent {
    focused = false;

    constructor(public options: { question: string; onSubmit: (answer: string) => void; onCancel: () => void }) {
      mocks.lastDialog = this;
    }
  }

  return { AskQuestionDialogComponent: MockAskQuestionDialogComponent };
});

import { askModalQuestion } from '../modal-question.js';

function createTui() {
  return {
    hideOverlay: vi.fn(),
  } as any;
}

describe('askModalQuestion', () => {
  beforeEach(() => {
    mocks.showModalOverlay.mockReset();
    mocks.lastDialog = undefined;
  });

  it('shows and focuses a modal question, then hides the overlay and resolves on submit', async () => {
    const tui = createTui();

    const result = askModalQuestion(tui, {
      question: 'Choose a provider',
      options: [{ label: 'OpenAI' }],
      selectedOptionLabel: 'OpenAI',
      overlay: { widthPercent: 70, maxHeight: '80%' },
    });

    expect(mocks.lastDialog?.focused).toBe(true);
    expect(mocks.showModalOverlay).toHaveBeenCalledWith(tui, mocks.lastDialog, {
      maxHeight: '80%',
      widthPercent: 70,
    });

    mocks.lastDialog?.options.onSubmit('OpenAI');

    await expect(result).resolves.toBe('OpenAI');
    expect(tui.hideOverlay).toHaveBeenCalledTimes(1);
  });

  it('hides the overlay and resolves null on cancel', async () => {
    const tui = createTui();

    const result = askModalQuestion(tui, { question: 'Continue?' });

    expect(mocks.lastDialog?.focused).toBe(true);
    expect(mocks.showModalOverlay).toHaveBeenCalledWith(tui, mocks.lastDialog, { maxHeight: '50%' });

    mocks.lastDialog?.options.onCancel();

    await expect(result).resolves.toBeNull();
    expect(tui.hideOverlay).toHaveBeenCalledTimes(1);
  });
});
