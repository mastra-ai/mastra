// @vitest-environment jsdom
import type { TextPart } from '@mastra/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserTextPartRenderer } from '../user-text-part-renderer';

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

  it('renders plain markdown text otherwise', () => {
    const part = { type: 'text', text: 'just some **markdown**' } as TextPart;

    render(<UserTextPartRenderer part={part} />);

    expect(screen.getByText('markdown')).not.toBeNull();
  });
});
