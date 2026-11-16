import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';

describe('AskQuestionDialogComponent options with newlines', () => {
  it('renders each option on one line that fits the dialog width', () => {
    let submitted: string | undefined;
    const label = '95870929  every 15m · paused';
    const dialog = new AskQuestionDialogComponent({
      question: 'Schedules on this thread (1):',
      options: [{ label, description: '"Alerts Track A progress.\nPush work forward;\n\ndon\'t wait for the user."' }],
      allowCustomResponse: false,
      onSubmit: answer => {
        submitted = answer;
      },
      onCancel: () => {},
    });

    const width = 120;
    const lines = dialog.render(width);
    for (const line of lines) {
      expect(line).not.toMatch(/[\r\n]/);
      expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
    const plain = lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(plain.some(line => line.includes('"Alerts Track A progress. Push'))).toBe(true);

    dialog.handleInput('\r');
    expect(submitted).toBe(label);
  });
});
