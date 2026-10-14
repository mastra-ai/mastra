// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DropdownMenu } from '../DropdownMenu';
import { SortMenu } from './sort-menu';

type ItemSort = 'newest' | 'oldest';

const options = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
] as const satisfies readonly { value: ItemSort; label: string }[];

afterEach(() => {
  cleanup();
});

describe('SortMenu', () => {
  it('names the trigger after the selected option', () => {
    render(<SortMenu label="Sort items" options={options} value="newest" onValueChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Sort items: Newest' })).toBeTruthy();
  });

  it('falls back to the bare label when the value matches no option', () => {
    render(<SortMenu<string> label="Sort items" options={options} value="missing" onValueChange={() => {}} />);

    expect(screen.getByRole('button', { name: 'Sort items' })).toBeTruthy();
  });

  it('checks the selected option and reports the picked one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SortMenu label="Sort items" options={options} value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole('button', { name: 'Sort items: Newest' }));
    expect((await screen.findByRole('menuitemradio', { name: 'Newest' })).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('menuitemradio', { name: 'Oldest' }));

    expect(onValueChange).toHaveBeenCalledWith('oldest');
  });
});

describe('SortMenu.Sub', () => {
  it('shows the selected option on its row and reports the picked one', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenu.Trigger>Properties</DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <SortMenu.Sub options={options} value="newest" onValueChange={onValueChange} />
        </DropdownMenu.Content>
      </DropdownMenu>,
    );

    // jsdom has no geometry: pointer travel into a submenu leaves Base UI's safe polygon and closes it.
    act(() => screen.getByRole('menuitem', { name: /Sort.*Newest/ }).focus());
    await user.keyboard('{ArrowRight}');
    await user.click(await screen.findByRole('menuitemradio', { name: 'Oldest' }));

    expect(onValueChange).toHaveBeenCalledWith('oldest');
  });
});
