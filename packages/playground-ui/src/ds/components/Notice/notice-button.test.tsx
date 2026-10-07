// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Notice } from './Notice';

afterEach(cleanup);

describe('Notice.Button', () => {
  it('renders a native button that does not submit forms', () => {
    render(<Notice.Button>Retry</Notice.Button>);

    expect(screen.getByRole('button', { name: 'Retry' }).getAttribute('type')).toBe('button');
  });

  it('renders the element passed through render, with the icon before the label', () => {
    render(
      <Notice.Button icon={<svg data-testid="icon" />} render={<a href="https://example.com/guide" />}>
        Open guide
      </Notice.Button>,
    );

    const link = screen.getByRole('link', { name: 'Open guide' });
    expect(link.getAttribute('href')).toBe('https://example.com/guide');
    expect(link.hasAttribute('type')).toBe(false);
    expect(link.firstElementChild?.getAttribute('data-testid')).toBe('icon');
  });
});
