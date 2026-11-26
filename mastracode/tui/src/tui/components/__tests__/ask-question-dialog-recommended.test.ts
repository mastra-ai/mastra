import { describe, expect, it } from 'vitest';

import { AskQuestionDialogComponent } from '../ask-question-dialog.js';

const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));

describe('AskQuestionDialogComponent recommended option', () => {
  const options = [
    { label: 'Keep it local', description: 'Nothing ships' },
    { label: 'Open the PR', description: 'Push and open a draft', recommended: true },
  ];

  it('tags only the option the agent recommends', () => {
    const dialog = new AskQuestionDialogComponent({
      question: 'Shall I open the PR?',
      options,
      allowCustomResponse: false,
      onSubmit: () => {},
      onCancel: () => {},
    });

    const lines = plain(dialog.render(120));
    expect(lines.find(line => line.includes('Open the PR'))).toContain('(recommended)');
    expect(lines.find(line => line.includes('Keep it local'))).not.toContain('(recommended)');
  });

  it('keeps the tag visible after a label longer than its column', () => {
    const dialog = new AskQuestionDialogComponent({
      question: 'Which rollout?',
      options: [
        { label: 'Roll out to every region at once and watch the dashboards', description: 'Fast', recommended: true },
        { label: 'Wait' },
      ],
      onSubmit: () => {},
      onCancel: () => {},
    });
    expect(plain(dialog.render(80)).join('\n')).toContain('(recommended)');
  });

  it('leaves the choice to the user: the cursor stays on the first option and answers carry the bare label', () => {
    const submitted: string[] = [];
    const dialog = new AskQuestionDialogComponent({
      question: 'Shall I open the PR?',
      options,
      allowCustomResponse: false,
      onSubmit: answer => submitted.push(answer),
      onCancel: () => {},
    });

    dialog.handleInput('\r');
    expect(submitted).toEqual(['Keep it local']);
  });

  it('answers with the bare label when the user picks the recommended option', () => {
    const submitted: string[] = [];
    const dialog = new AskQuestionDialogComponent({
      question: 'Shall I open the PR?',
      options,
      allowCustomResponse: false,
      onSubmit: answer => submitted.push(answer),
      onCancel: () => {},
    });

    dialog.handleInput('\x1b[B');
    dialog.handleInput('\r');
    expect(submitted).toEqual(['Open the PR']);
  });
});
