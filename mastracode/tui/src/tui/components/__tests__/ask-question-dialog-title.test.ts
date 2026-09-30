import { describe, expect, it } from 'vitest';

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';

function heading(title?: string): string {
  const dialog = new AskQuestionDialogComponent({
    question: 'Pick one',
    options: [{ label: 'A' }],
    ...(title ? { title } : {}),
    onSubmit: () => {},
    onCancel: () => {},
  });
  return dialog
    .render(60)
    .map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim())
    .find(line => line.length > 0)!;
}

describe('AskQuestionDialogComponent title', () => {
  it('defaults to "Question"', () => {
    expect(heading()).toBe('Question');
  });

  it('uses the given title', () => {
    expect(heading('Schedules')).toBe('Schedules');
  });
});
