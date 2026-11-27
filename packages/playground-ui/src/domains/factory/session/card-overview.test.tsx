// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CardDescription } from './card-description';
import { CardOverview } from './card-overview';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('CardOverview', () => {
  it('leaves out the activity section when there is no activity', () => {
    render(<CardOverview source="Issue #117" activity={null} />);
    expect(screen.getByRole('region', { name: 'Card' }).textContent).toBe('Issue #117');
    expect(screen.queryByRole('region', { name: 'Card activity' })).toBeNull();
  });

  it('puts the host workspace between the card and its activity', () => {
    render(<CardOverview source="Issue #117" workspace={<p>Workspace</p>} activity="Moves" />);
    const order = Array.from(document.body.querySelectorAll('section, p')).map(node => node.textContent);
    expect(order).toEqual(['Issue #117', 'Workspace', 'Moves']);
  });
});

describe('CardDescription', () => {
  it('reads the upstream body first and labels the card’s own under it', () => {
    render(<CardDescription source="Upstream body" own="Own note" ownLabel="Added on the card" />);
    expect(screen.getByText('Upstream body')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Added on the card' })).toBeTruthy();
    expect(screen.getByText('Own note')).toBeTruthy();
  });

  it('says the description could not be loaded when the read failed and there is none', () => {
    render(<CardDescription source={null} own={null} failed />);
    expect(screen.getByText('The description could not be loaded.')).toBeTruthy();
  });

  it('renders nothing when there is no description', () => {
    const { container } = render(<CardDescription source={null} own="  " />);
    expect(container.innerHTML).toBe('');
  });

  it('shows a loading placeholder while the upstream body loads', () => {
    render(<CardDescription loading />);
    expect(screen.getByRole('status', { name: 'Loading description' })).toBeTruthy();
  });
});
