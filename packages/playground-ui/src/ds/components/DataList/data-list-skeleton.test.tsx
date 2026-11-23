// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DataListSkeleton } from './data-list-skeleton';

describe('DataListSkeleton', () => {
  it('renders one header cell per track, including minmax() tracks with spaces', () => {
    const { container } = render(<DataListSkeleton columns="auto auto minmax(0, 10rem) minmax(0, 40rem)" />);
    const top = container.querySelector('.data-list-top');
    expect(top?.children).toHaveLength(4);
  });
});
