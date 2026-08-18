// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DataListTimeCell } from './data-list-cells';

afterEach(cleanup);

describe('DataListTimeCell', () => {
  it('shows 12-hour time by default', () => {
    const { container } = render(<DataListTimeCell timestamp={new Date(2026, 5, 1, 17, 9, 59, 665)} />);

    expect(container.textContent).toBe('5:09:59.665 pm');
  });
});
