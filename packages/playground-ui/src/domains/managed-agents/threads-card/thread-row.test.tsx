// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThreadRow } from './thread-row';

afterEach(cleanup);

describe('ThreadRow', () => {
  it('marks a private thread with a lock', () => {
    render(
      <ul>
        <ThreadRow href="#a" title="Deal desk" updated="4m" agents={[{ name: 'Kit' }]} private />
      </ul>,
    );

    expect(screen.getByRole('img', { name: 'Private' })).toBeTruthy();
  });

  it('shows no lock on a shared thread', () => {
    render(
      <ul>
        <ThreadRow href="#a" title="Deal desk" updated="4m" agents={[{ name: 'Kit' }]} />
      </ul>,
    );

    expect(screen.queryByRole('img', { name: 'Private' })).toBeNull();
  });
});
