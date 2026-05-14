import type { OverlayOptions, TUI } from '@mariozechner/pi-tui';

import { AskQuestionDialogComponent } from './components/ask-question-dialog.js';
import { showModalOverlay } from './overlay.js';

export type ModalQuestionOption = { label: string; description?: string };

export type ModalQuestionOptions = {
  question: string;
  options?: ModalQuestionOption[];
  defaultValue?: string;
  allowEmptyInput?: boolean;
  multiline?: boolean;
  overlay?: {
    widthPercent?: number;
    maxHeight?: OverlayOptions['maxHeight'];
  };
};

export function askModalQuestion(tui: TUI, options: ModalQuestionOptions): Promise<string | null> {
  return new Promise(resolve => {
    const question = new AskQuestionDialogComponent({
      question: options.question,
      options: options.options,
      multiline: options.multiline,
      tui,
      allowEmptyInput: options.allowEmptyInput,
      defaultValue: options.defaultValue,
      onSubmit: answer => {
        tui.hideOverlay();
        resolve(answer);
      },
      onCancel: () => {
        tui.hideOverlay();
        resolve(null);
      },
    });

    showModalOverlay(tui, question, { maxHeight: '50%', ...options.overlay });
    question.focused = true;
  });
}
