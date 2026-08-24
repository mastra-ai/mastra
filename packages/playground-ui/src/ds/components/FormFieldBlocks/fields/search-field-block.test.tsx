// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchFieldBlock } from './search-field-block';

afterEach(() => {
  cleanup();
});

describe('SearchFieldBlock', () => {
  it('removes a vertically hidden label from the layout flow', () => {
    render(<SearchFieldBlock name="search" label="Search" labelIsHidden />);

    const label = screen.getByText('Search');

    expect(label.tagName).toBe('LABEL');
    expect(label.classList.contains('sr-only')).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' }).id).toBe('input-search');
  });

  it('hides the horizontal label column while preserving the accessible name', () => {
    const { container } = render(<SearchFieldBlock name="search" label="Search" labelIsHidden layout="horizontal" />);

    const [labelColumn, inputColumn] = container.firstElementChild?.children ?? [];

    expect(labelColumn?.classList.contains('sr-only')).toBe(true);
    expect(inputColumn?.classList.contains('col-span-full')).toBe(true);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' }).id).toBe('input-search');
  });

  it('leaves a vertical layout unspanned even when its label is hidden', () => {
    const { container } = render(<SearchFieldBlock name="search" label="Search" labelIsHidden />);

    const column = container.firstElementChild?.firstElementChild;
    expect(column?.classList.contains('col-span-full')).toBe(false);
  });

  it('keeps a visible horizontal label in a separate column', () => {
    const { container } = render(<SearchFieldBlock name="search" label="Search" layout="horizontal" />);

    const [labelColumn, inputColumn] = container.firstElementChild?.children ?? [];

    expect(labelColumn?.classList.contains('sr-only')).toBe(false);
    expect(inputColumn?.classList.contains('col-span-full')).toBe(false);
  });
});

/** The column holding the field, and whatever the caller put under it. */
const fieldColumn = (container: HTMLElement) => container.firstElementChild?.firstElementChild;

describe('SearchFieldBlock — the field itself', () => {
  it('invites a search unless the caller says otherwise', () => {
    render(<SearchFieldBlock name="search" />);

    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('takes the placeholder the caller gives it', () => {
    render(<SearchFieldBlock name="search" placeholder="Find a trace" />);

    expect(screen.getByPlaceholderText('Find a trace')).toBeTruthy();
  });

  it('reports what the reader typed', () => {
    const onChange = vi.fn();
    render(<SearchFieldBlock name="search" onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'weather' } });

    expect(onChange).toHaveBeenCalled();
  });

  it('cannot be typed into while disabled', () => {
    render(<SearchFieldBlock name="search" disabled />);

    expect(screen.getByRole<HTMLInputElement>('textbox').disabled).toBe(true);
  });

  it('explains itself and its complaints', () => {
    const { container } = render(
      <SearchFieldBlock name="search" helpText="Matches names and ids" errorMsg="Too short" />,
    );

    expect(screen.getByText('Matches names and ids')).toBeTruthy();
    expect(screen.getByText('Too short')).toBeTruthy();
    // The field, its help text and its complaint.
    expect(fieldColumn(container)?.childElementCount).toBe(3);
  });

  it('puts nothing under the field when it has nothing to say', () => {
    const { container } = render(<SearchFieldBlock name="search" />);

    expect(fieldColumn(container)?.childElementCount).toBe(1);
  });

  it('leaves out a label it was never given', () => {
    const { container } = render(<SearchFieldBlock name="search" />);

    expect(container.querySelector('label')).toBeNull();
  });
});

describe('SearchFieldBlock — clearing', () => {
  it('offers no clear button until there is something to clear', () => {
    render(<SearchFieldBlock name="search" onReset={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('offers no clear button without anywhere to report it', () => {
    render(<SearchFieldBlock name="search" value="weather" />);

    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('clears what was typed', () => {
    const onReset = vi.fn();
    render(<SearchFieldBlock name="search" value="weather" onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('SearchFieldBlock — minimizing', () => {
  it('shows only an icon while minimized', () => {
    render(<SearchFieldBlock name="search" label="Search traces" isMinimized />);

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Search traces' })).toBeTruthy();
  });

  it('names the minimized button Search when it has no label', () => {
    render(<SearchFieldBlock name="search" isMinimized />);

    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('opens the field on request', () => {
    const onMinimizedChange = vi.fn();
    render(<SearchFieldBlock name="search" isMinimized onMinimizedChange={onMinimizedChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onMinimizedChange).toHaveBeenCalledWith(false);
  });

  it('cannot be opened while disabled', () => {
    render(<SearchFieldBlock name="search" isMinimized disabled onMinimizedChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Search' }).hasAttribute('disabled')).toBe(true);
  });

  it('takes focus as soon as it opens', () => {
    render(<SearchFieldBlock name="search" isMinimized={false} onMinimizedChange={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('takes focus when it opens from the icon', () => {
    const { rerender } = render(<SearchFieldBlock name="search" isMinimized onMinimizedChange={vi.fn()} />);
    rerender(<SearchFieldBlock name="search" isMinimized={false} onMinimizedChange={vi.fn()} />);

    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('opens quietly when there is nowhere to report it', () => {
    render(<SearchFieldBlock name="search" isMinimized />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Search' }))).not.toThrow();
  });

  it('explains the minimized button in the caller’s words', async () => {
    render(<SearchFieldBlock name="search" isMinimized label="Search traces" />);

    fireEvent.focus(screen.getByRole('button', { name: 'Search traces' }));

    expect(await screen.findByText('Search traces')).toBeTruthy();
  });

  it('explains the minimized button in its own words when it has no label', async () => {
    render(<SearchFieldBlock name="search" isMinimized />);

    fireEvent.focus(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('Search')).toBeTruthy();
  });

  it('leaves focus alone when minimizing was never in play', () => {
    render(<SearchFieldBlock name="search" />);

    expect(document.activeElement).not.toBe(screen.getByRole('textbox'));
  });

  it('offers a way back to the icon even with nothing typed', () => {
    const onMinimizedChange = vi.fn();
    const onReset = vi.fn();
    render(
      <SearchFieldBlock name="search" isMinimized={false} onMinimizedChange={onMinimizedChange} onReset={onReset} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onMinimizedChange).toHaveBeenCalledWith(true);
    // Nothing was typed, so there is nothing to reset.
    expect(onReset).not.toHaveBeenCalled();
  });

  it('leaves minimizing alone when it was never in play', () => {
    const onMinimizedChange = vi.fn();
    render(<SearchFieldBlock name="search" value="weather" onReset={vi.fn()} onMinimizedChange={onMinimizedChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onMinimizedChange).not.toHaveBeenCalled();
  });

  it('folds back quietly when there is nowhere to report it', () => {
    render(<SearchFieldBlock name="search" value="weather" isMinimized={false} onReset={vi.fn()} />);

    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))).not.toThrow();
  });

  it('clears what was typed and folds back to the icon in one go', () => {
    const onMinimizedChange = vi.fn();
    const onReset = vi.fn();
    render(
      <SearchFieldBlock
        name="search"
        value="weather"
        isMinimized={false}
        onMinimizedChange={onMinimizedChange}
        onReset={onReset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onMinimizedChange).toHaveBeenCalledWith(true);
  });
});

describe('SearchFieldBlock — sizing', () => {
  it.each([
    ['sm', 'px-8', 'size-3.5'],
    ['md', 'px-9', 'size-4'],
    ['default', 'px-10', 'size-[1.125rem]'],
    ['lg', 'px-11', 'size-5'],
  ])('leaves room for the icon at size %s', (size, padding, iconSize) => {
    const { container } = render(<SearchFieldBlock name="search" size={size as 'sm' | 'md' | 'default' | 'lg'} />);

    expect(screen.getByRole('textbox').classList.contains(padding)).toBe(true);
    expect(container.querySelector('svg')?.classList.contains(iconSize)).toBe(true);
  });

  it('leaves the default room when no size was given', () => {
    const { container } = render(<SearchFieldBlock name="search" />);

    expect(screen.getByRole('textbox').classList.contains('px-10')).toBe(true);
    expect(container.querySelector('svg')?.classList.contains('size-[1.125rem]')).toBe(true);
  });

  // The buttons carry the field's own height, so the row keeps one line.
  it.each([
    ['sm', 'h-form-sm'],
    ['md', 'h-form-md'],
    ['default', 'h-form-default'],
    ['lg', 'h-form-default'],
  ])('sizes the minimized button to a %s field', (size, height) => {
    render(<SearchFieldBlock name="search" isMinimized size={size as 'sm' | 'md' | 'default' | 'lg'} />);

    expect(screen.getByRole('button', { name: 'Search' }).classList.contains(height)).toBe(true);
  });

  it('keeps the minimized button compact when the field has no size', () => {
    render(<SearchFieldBlock name="search" isMinimized />);

    expect(screen.getByRole('button', { name: 'Search' }).classList.contains('h-form-sm')).toBe(true);
  });

  it('sizes the clear button to the field it sits in', () => {
    render(<SearchFieldBlock name="search" value="weather" onReset={vi.fn()} size="md" />);

    expect(screen.getByRole('button', { name: 'Clear search' }).classList.contains('h-form-md')).toBe(true);
  });

  it('gives the clear button the roomy size when the field has none', () => {
    render(<SearchFieldBlock name="search" value="weather" onReset={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Clear search' }).classList.contains('h-form-default')).toBe(true);
  });
});
