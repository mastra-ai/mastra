// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchInput } from './search-input';

afterEach(cleanup);

function ControlledSearch({ onClose }: { onClose?: () => void }) {
  const [value, setValue] = useState('');
  return <SearchInput label="Search code" value={value} onValueChange={setValue} onClose={onClose} />;
}

describe('SearchInput clearing', () => {
  it('clears the field and keeps focus in it', () => {
    render(<ControlledSearch />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search code' });

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    fireEvent.change(input, { target: { value: 'span' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});

describe('SearchInput that collapses', () => {
  it('can be closed while empty', () => {
    const onClose = vi.fn();
    render(<ControlledSearch onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clears what was typed when closed', () => {
    render(<ControlledSearch onClose={() => {}} />);
    const input = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search code' });

    fireEvent.change(input, { target: { value: 'span' } });
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));

    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});
