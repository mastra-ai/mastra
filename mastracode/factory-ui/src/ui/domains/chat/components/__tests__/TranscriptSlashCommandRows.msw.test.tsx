import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SlashCommandMessage } from '../SlashCommandMessage';
import { parseSlashCommandActivation } from '../skill-activation';

describe('parseSlashCommandActivation', () => {
  it('parses the envelope produced by formatSlashCommandActivation', () => {
    const text = '<slash-command name="review">\nReview the working tree\n</slash-command>';
    expect(parseSlashCommandActivation(text)).toEqual({ name: 'review', content: 'Review the working tree' });
  });

  it('unescapes a literal closing boundary in the content', () => {
    const text = '<slash-command name="deploy">\nUse &lt;/slash-command&gt; carefully\n</slash-command>';
    expect(parseSlashCommandActivation(text)?.content).toBe('Use </slash-command> carefully');
  });

  it('rejects non-envelope and empty bodies', () => {
    expect(parseSlashCommandActivation('<skill name="x">body</skill>')).toBeUndefined();
    expect(parseSlashCommandActivation('plain text')).toBeUndefined();
    expect(parseSlashCommandActivation('<slash-command name="x">\n  \n</slash-command>')).toBeUndefined();
    expect(
      parseSlashCommandActivation('<slash-command name="x">content</slash-command> trailing raw XML </slash-command>'),
    ).toBeUndefined();
  });
});

describe('SlashCommandMessage rendering', () => {
  it('renders a compact expandable row and never shows raw envelope XML', async () => {
    const activation = parseSlashCommandActivation(
      '<slash-command name="review">\nReview **the** tree\n</slash-command>',
    );
    expect(activation).toBeDefined();
    render(<SlashCommandMessage activation={activation!} />);

    expect(screen.getByRole('group', { name: 'Slash command: review' })).toBeInTheDocument();
    expect(screen.queryByText(/slash-command name=/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/Review/)).toBeInTheDocument();
  });

  it('keeps an escaped closing boundary unescaped in expanded content only after parsing', () => {
    const activation = parseSlashCommandActivation(
      '<slash-command name="deploy">\nWrite &lt;/slash-command&gt; safely\n</slash-command>',
    );
    render(<SlashCommandMessage activation={activation!} />);
    // Raw escape sequence never leaks into the collapsed row.
    expect(screen.queryByText(/&lt;\/slash-command&gt;/)).not.toBeInTheDocument();
  });
});
