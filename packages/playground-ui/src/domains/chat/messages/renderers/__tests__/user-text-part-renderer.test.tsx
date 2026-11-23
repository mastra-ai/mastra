// @vitest-environment jsdom
import type { TextPart } from '@mastra/react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UserTextPartRenderer } from '../user-text-part-renderer';

afterEach(() => cleanup());

describe('UserTextPartRenderer', () => {
  it('renders a system-reminder badge for system-reminder text', () => {
    const part = {
      type: 'text',
      text: '<system-reminder>path/to/file.ts updated</system-reminder>',
    } as TextPart;

    render(<UserTextPartRenderer part={part} />);

    expect(screen.getAllByText('System reminder').length).toBeGreaterThan(0);
  });

  it('renders an in-message attachment preview (not raw markdown) for attachment text', () => {
    const part = { type: 'text', text: '<attachment name="notes.txt">hello body</attachment>' } as TextPart;

    const { container } = render(<UserTextPartRenderer part={part} />);

    // The collapsed TxtEntry preview shows an open-preview button, not the body.
    expect(container.querySelector('button')).not.toBeNull();
    expect(screen.queryByText(/hello body/)).toBeNull();
  });

  describe('when several named text attachments are rendered', () => {
    it('identifies each preview by its decoded filename', () => {
      render(
        <>
          <UserTextPartRenderer part={{ type: 'text', text: '<attachment name="leads.csv">name,score</attachment>' }} />
          <UserTextPartRenderer
            part={{ type: 'text', text: '<attachment name="a&amp;&quot;&lt;b&gt;.txt">notes</attachment>' }}
          />
        </>,
      );
      expect(screen.getByRole('button', { name: 'Preview leads.csv' }).textContent).toContain('leads.csv');
      fireEvent.click(screen.getByRole('button', { name: 'Preview a&"<b>.txt' }));
      expect(screen.getByRole('dialog', { name: 'a&"<b>.txt' }).textContent).toContain('notes');
    });
  });

  describe('when attachment contents contain attachment-like tags', () => {
    it('preserves the literal contents in the preview', () => {
      const text = 'name,note\r\nZoë,"<attachment>literal</attachment>"\r\n';
      const part = { type: 'text' as const, text: `<attachment name="notes.csv">${text}</attachment>` };
      render(<UserTextPartRenderer part={part} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/Zoë/).textContent).toBe(text);
    });
  });

  it('renders plain markdown text otherwise', () => {
    const part = { type: 'text', text: 'just some **markdown**' } as TextPart;

    render(<UserTextPartRenderer part={part} />);

    expect(screen.getByText('markdown')).not.toBeNull();
  });
});
