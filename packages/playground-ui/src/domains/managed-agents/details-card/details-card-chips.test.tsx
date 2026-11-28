// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DetailsCardChips } from './details-card-chips';

afterEach(cleanup);

describe('DetailsCardChips', () => {
  it('folds the chips past the limit into a +N chip that names them', () => {
    render(<DetailsCardChips items={['a', 'b', 'c', 'd', 'e', 'f']} max={4} label="more tools" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: '2 more tools: e, f' }).textContent).toBe('+2');
  });

  it('shows every chip and no +N when they fit', () => {
    render(<DetailsCardChips items={['a', 'b']} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
