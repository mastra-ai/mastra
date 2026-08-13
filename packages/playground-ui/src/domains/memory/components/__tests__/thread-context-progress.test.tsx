// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThreadContextProgress } from '../thread-context-progress';

afterEach(() => {
  cleanup();
});

describe('ThreadContextProgress', () => {
  it('drops a budget with no threshold instead of drawing it full', () => {
    render(
      <ThreadContextProgress messageTokens={0} messageThreshold={0} memoryTokens={5_000} memoryThreshold={8_000} />,
    );

    expect(screen.queryByText('Messages')).toBeNull();
    expect(screen.getByText('Memory')).toBeTruthy();
  });
});
