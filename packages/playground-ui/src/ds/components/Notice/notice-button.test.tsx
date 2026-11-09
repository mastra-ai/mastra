// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Notice } from './Notice';

afterEach(cleanup);

describe('Notice.Button', () => {
  it('renders a native button that does not submit forms', () => {
    render(<Notice.Button>Retry</Notice.Button>);

    expect(screen.getByRole('button', { name: 'Retry' }).getAttribute('type')).toBe('button');
  });

  it('does not submit forms when render supplies a native button', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Notice.Button render={<button />}>Retry</Notice.Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('honors an explicit submit type', () => {
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Notice.Button type="submit">Confirm</Notice.Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('does not activate a disabled button', () => {
    const onClick = vi.fn();
    render(
      <Notice.Button disabled onClick={onClick}>
        Retry
      </Notice.Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).not.toHaveBeenCalled();
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
