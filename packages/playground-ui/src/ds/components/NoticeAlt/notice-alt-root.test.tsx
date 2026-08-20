// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NoticeAlt } from './NoticeAlt';

afterEach(cleanup);

describe('NoticeAlt', () => {
  it('renders a titled message and action', () => {
    render(
      <NoticeAlt variant="warning" title="Review changes" action={<NoticeAlt.Button>Review</NoticeAlt.Button>}>
        <NoticeAlt.Message>Two settings changed.</NoticeAlt.Message>
      </NoticeAlt>,
    );

    expect(screen.getByText('Review changes')).toBeTruthy();
    expect(screen.getByText('Two settings changed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy();
    expect(screen.getByText('Review changes').closest('[data-slot="notice-alt"]')?.dataset.surface).toBe('neutral');
  });

  it('forwards semantic attributes to the root', () => {
    render(
      <NoticeAlt variant="destructive" surface="tinted" role="alert" aria-label="Save failed">
        Save failed.
      </NoticeAlt>,
    );

    const notice = screen.getByRole('alert', { name: 'Save failed' });
    expect(notice.dataset.variant).toBe('destructive');
    expect(notice.dataset.surface).toBe('tinted');
  });

  it('exposes the grainy fade surface', () => {
    render(
      <NoticeAlt variant="info" surface="grainy-fade" aria-label="Dataset info">
        Dataset info.
      </NoticeAlt>,
    );

    expect(screen.getByLabelText('Dataset info').dataset.surface).toBe('grainy-fade');
  });
});
