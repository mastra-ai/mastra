import { describe, expect, it } from 'vitest';

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';

function dialog(question: string, title?: string): AskQuestionDialogComponent {
  return new AskQuestionDialogComponent({
    question,
    options: [{ label: 'A' }],
    ...(title ? { title } : {}),
    onSubmit: () => {},
    onCancel: () => {},
  });
}

const plainLines = (component: AskQuestionDialogComponent) =>
  component.render(60).map(line => line.replace(/\x1b\[[0-9;]*m/g, '').trim());

describe('AskQuestionDialogComponent title', () => {
  it('uses a short one-line question as the menu title', () => {
    const component = dialog('Pick one:');
    expect(component.menuTitle()).toBe('Pick one');
    expect(plainLines(component)).not.toContain('Pick one:');
  });

  it('defaults to "Question" and shows a long question above the options', () => {
    const component = dialog('Line one\nLine two');
    expect(component.menuTitle()).toBe('Question');
    expect(plainLines(component).slice(0, 2)).toEqual(['Line one', 'Line two']);
  });

  it('uses the given title', () => {
    expect(dialog('Pick one', 'Schedules').menuTitle()).toBe('Schedules');
  });
});
