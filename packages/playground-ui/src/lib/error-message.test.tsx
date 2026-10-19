// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { errorToast } from './error-message';
import type { ErrorMessage } from './error-message';
import { ErrorNotice } from './error-notice';
import { Toaster } from './toast';

const deleteDatabase: ErrorMessage = {
  title: 'Couldn’t delete orders-db',
  why: 'Two environments still use it.',
  reassurance: 'Nothing was deleted.',
  fix: 'Detach it from both environments, then delete it.',
  wayOut: { kind: 'docs', href: 'https://mastra.ai/docs' },
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('errorToast', () => {
  it('shows what happened as the title and the cause plus next step as the description', async () => {
    render(<Toaster />);
    act(() => {
      errorToast(deleteDatabase);
    });

    expect(await screen.findByText('Couldn’t delete orders-db')).toBeTruthy();
    expect(
      screen.getByText('Two environments still use it. Detach it from both environments, then delete it.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Nothing was deleted/)).toBeNull();
  });

  it('offers the way out as the toast action, opening it in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<Toaster />);
    act(() => {
      errorToast(deleteDatabase);
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Docs ↗' }));
    expect(open).toHaveBeenCalledWith('https://mastra.ai/docs', '_blank', 'noopener,noreferrer');
  });

  it('keeps the caller’s own action instead of the way out', async () => {
    render(<Toaster />);
    act(() => {
      errorToast(deleteDatabase, { action: { label: 'Retry', onClick: () => {} } });
    });

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Docs ↗' })).toBeNull();
  });
});

describe('ErrorNotice', () => {
  it('renders every part, with the way out as a link', () => {
    render(<ErrorNotice message={deleteDatabase} />);

    expect(screen.getByText('Couldn’t delete orders-db')).toBeTruthy();
    expect(
      screen.getByText(
        'Two environments still use it. Nothing was deleted. Detach it from both environments, then delete it.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('https://mastra.ai/docs');
  });

  it('leaves out reassurance and the link when the message has none', () => {
    const { title, why, fix } = deleteDatabase;
    render(<ErrorNotice message={{ title, why, fix }} />);

    expect(
      screen.getByText('Two environments still use it. Detach it from both environments, then delete it.'),
    ).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
