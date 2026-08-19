import type { OverlayOptions, TUI } from '@earendil-works/pi-tui';

import { AskQuestionDialogComponent } from './components/ask-question-dialog.js';
import { showModalOverlay } from './overlay.js';

export type ModalQuestionOption = { label: string; description?: string };

export type ModalQuestionOptions = {
  question: string;
  options?: ModalQuestionOption[];
  defaultValue?: string;
  allowEmptyInput?: boolean;
  allowCustomResponse?: boolean;
  selectedOptionLabel?: string;
  multiline?: boolean;
  signal?: AbortSignal;
  overlay?: {
    widthPercent?: number;
    maxHeight?: OverlayOptions['maxHeight'];
  };
};

export function askModalQuestion(tui: TUI, options: ModalQuestionOptions): Promise<string | null> {
  if (options.signal?.aborted) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const finish = (answer: string | null) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', onAbort);
      tui.hideOverlay();
      resolve(answer);
    };
    const onAbort = () => finish(null);
    const question = new AskQuestionDialogComponent({
      question: options.question,
      options: options.options,
      multiline: options.multiline,
      tui,
      allowEmptyInput: options.allowEmptyInput,
      allowCustomResponse: options.allowCustomResponse,
      selectedOptionLabel: options.selectedOptionLabel,
      defaultValue: options.defaultValue,
      onSubmit: answer => finish(answer),
      onCancel: () => finish(null),
    });

    options.signal?.addEventListener('abort', onAbort, { once: true });
    showModalOverlay(tui, question, { maxHeight: '50%', ...options.overlay });
    question.focused = true;
  });
}
