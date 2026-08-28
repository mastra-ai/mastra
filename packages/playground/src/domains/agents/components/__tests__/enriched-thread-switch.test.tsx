import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { EnrichedThreadSwitch } from '../enriched-thread-switch';

function CurrentSearch() {
  return <span data-testid="search">{useLocation().search}</span>;
}

const renderSwitch = ({ hasTraces = true, search = '' } = {}) =>
  render(
    <MemoryRouter initialEntries={[`/agents/a/chat/t${search}`]}>
      <EnrichedThreadSwitch hasTraces={hasTraces} />
      <CurrentSearch />
    </MemoryRouter>,
  );

describe('EnrichedThreadSwitch', () => {
  it('stays hidden when the thread has no traces to enrich it with', () => {
    renderSwitch({ hasTraces: false });

    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('is off by default, so a plain chat URL reads as a plain chat', () => {
    renderSwitch();

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('turns enriched mode on by putting it in the URL', () => {
    renderSwitch();

    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByTestId('search').textContent).toBe('?enriched=true');
  });

  it('reads its state from the URL and clears the param when turned off', () => {
    renderSwitch({ search: '?enriched=true&other=1' });

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('switch'));

    expect(screen.getByTestId('search').textContent).toBe('?other=1');
  });
});
