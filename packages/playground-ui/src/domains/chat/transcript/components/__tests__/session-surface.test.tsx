// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';
import { SessionSurface } from '../session/session-surface';

describe('SessionSurface', () => {
  it('renders for a host that has no annotations', () => {
    render(
      <SessionSurface
        busy={false}
        preparing={false}
        tasks={[]}
        loadMore={{ hasMore: false, isLoading: false }}
        composer={null}
        composerLabel="Message composer"
      >
        <p>Hello there</p>
      </SessionSurface>,
    );
    expect(screen.getByText('Hello there')).toBeTruthy();
  });
});
