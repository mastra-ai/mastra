// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BoardCardRows } from './board-card-rows';

afterEach(cleanup);

describe('BoardCardRows', () => {
  it('reads the meta line, title and the other stages the card sits in', () => {
    render(<BoardCardRows meta={['#117', 'mastra-ai/office']} title="Game scaffold" otherStages={['Review']} />);
    expect(screen.getByText('#117')).toBeTruthy();
    expect(screen.getByText('Game scaffold')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
  });

  it('leaves out the status row when there is nothing to say', () => {
    const quiet = render(<BoardCardRows meta={[]} title="Quiet" />).container.childElementCount;
    cleanup();
    const busy = render(<BoardCardRows meta={[]} title="Busy" status={<span>Running</span>} />).container
      .childElementCount;
    expect(busy).toBe(quiet + 1);
  });
});
