// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  DataListActionsCell,
  DataListCell,
  DataListCreatedCell,
  DataListDateCell,
  DataListDescriptionCell,
  DataListIdCell,
  DataListNameCell,
  DataListNumberCell,
  DataListRowHeaderCell,
  DataListSelectCell,
  DataListTextCell,
  DataListTimeCell,
} from './data-list-cells';
import { DataListTopSelectCell } from './data-list-top-cell';

// jsdom ships no PointerEvent; Base UI's Checkbox constructs one to decide
// whether a click came from a pointer or the keyboard.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventStub extends MouseEvent {}
    window.PointerEvent = PointerEventStub as unknown as typeof PointerEvent;
  }
});

afterEach(cleanup);

const cellOf = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('DataListCell', () => {
  it('renders a span by default', () => {
    const { container } = render(<DataListCell>content</DataListCell>);

    expect(cellOf(container).tagName).toBe('SPAN');
    expect(cellOf(container).textContent).toBe('content');
  });

  it('renders whatever element the caller asks for', () => {
    const { container } = render(<DataListCell as="label">content</DataListCell>);

    expect(cellOf(container).tagName).toBe('LABEL');
  });

  it('leaves vertical space to the row, so no cell can make one row taller than the next', () => {
    const verticalPaddingOf = (ui: ReactElement) => {
      const { container } = render(ui);
      const padding = [...cellOf(container).classList].filter(name => /^(py|p)-/.test(name));
      cleanup();
      return padding;
    };

    expect(verticalPaddingOf(<DataListCell>content</DataListCell>)).toEqual([]);
    expect(verticalPaddingOf(<DataListNumberCell>1,200</DataListNumberCell>)).toEqual([]);
    expect(verticalPaddingOf(<DataListTextCell font="mono">abc</DataListTextCell>)).toEqual([]);
  });

  it('pins itself to the start edge only when asked to', () => {
    const { container } = render(<DataListCell>content</DataListCell>);
    expect(cellOf(container).classList.contains('sticky')).toBe(false);

    cleanup();

    const pinned = render(<DataListCell sticky="start">content</DataListCell>);
    expect(cellOf(pinned.container).classList.contains('sticky')).toBe(true);
  });

  it('keeps a caller class alongside its own', () => {
    const { container } = render(<DataListCell className="my-own-class">content</DataListCell>);

    expect(cellOf(container).classList.contains('my-own-class')).toBe(true);
    expect(cellOf(container).classList.contains('min-w-0')).toBe(true);
  });

  it('passes the rest of its props through to the element', () => {
    const { container } = render(<DataListCell data-testid="cell" title="a cell" />);

    expect(cellOf(container).getAttribute('title')).toBe('a cell');
    expect(screen.getByTestId('cell')).toBeTruthy();
  });
});

describe('control visibility', () => {
  it('keeps row and header selection checkboxes visible without hover', () => {
    const row = render(<DataListSelectCell checked={false} onToggle={() => {}} />);
    expect(row.container.firstElementChild?.classList.contains('opacity-0')).toBe(false);
    cleanup();

    const header = render(<DataListTopSelectCell checked={false} onToggle={() => {}} />);
    expect(header.container.firstElementChild?.classList.contains('opacity-0')).toBe(false);
  });

  it('keeps row actions discreet but reachable on devices that cannot hover', () => {
    const { container } = render(<DataListActionsCell>action</DataListActionsCell>);
    const hidden = container.querySelector('.opacity-0');

    expect(hidden).not.toBeNull();
    expect(hidden?.classList.contains('pointer-coarse:opacity-100')).toBe(true);
  });
});

describe('DataListTextCell', () => {
  it('sets code text in mono, still truncating', () => {
    const { container } = render(<DataListTextCell font="mono">a long identifier</DataListTextCell>);

    expect(cellOf(container).classList.contains('font-mono')).toBe(true);
    expect(container.querySelector('.truncate')).not.toBeNull();
    expect(container.textContent).toBe('a long identifier');
  });

  it('wraps bare text so it can truncate on its own', () => {
    const { container } = render(<DataListTextCell>a very long value</DataListTextCell>);

    expect(container.textContent).toBe('a very long value');
    expect(container.querySelector('.truncate')).not.toBeNull();
  });

  it('leaves an element child in place, adding room for it to truncate', () => {
    const { container } = render(
      <DataListTextCell>
        <div className="caller-class">wrapped</div>
      </DataListTextCell>,
    );

    const wrapped = container.querySelector('.caller-class');
    expect(wrapped).not.toBeNull();
    expect(wrapped?.classList.contains('min-w-0')).toBe(true);
  });

  it('truncates the text inside an element child too', () => {
    const { container } = render(
      <DataListTextCell>
        <div>inner text</div>
      </DataListTextCell>,
    );

    const wrapper = container.querySelector('span > div');
    const inner = wrapper?.firstElementChild;
    expect(inner?.tagName).toBe('SPAN');
    expect(inner?.textContent).toBe('inner text');
    expect(inner?.classList.contains('truncate')).toBe(true);
  });

  it('leaves a component child alone', () => {
    const Custom = () => <em data-testid="custom">custom</em>;
    const { container } = render(
      <DataListTextCell>
        <Custom />
      </DataListTextCell>,
    );

    expect(screen.getByTestId('custom').classList.contains('min-w-0')).toBe(false);
    expect(container.textContent).toBe('custom');
  });

  it('renders a number as truncatable text', () => {
    const { container } = render(<DataListTextCell>{42}</DataListTextCell>);

    expect(container.textContent).toBe('42');
  });

  it('truncates a number inside an element child too', () => {
    const { container } = render(
      <DataListTextCell>
        <div>{42}</div>
      </DataListTextCell>,
    );

    const inner = container.querySelector('span > div')?.firstElementChild;
    expect(inner?.tagName).toBe('SPAN');
    expect(inner?.textContent).toBe('42');
    expect(inner?.classList.contains('truncate')).toBe(true);
  });

  it('leaves an element nested inside an element child as it is', () => {
    const { container } = render(
      <DataListTextCell>
        <div>
          <b>bold</b>
        </div>
      </DataListTextCell>,
    );

    // Only bare text and numbers get a truncating wrapper; markup is left alone.
    const inner = container.querySelector('span > div')?.firstElementChild;
    expect(inner?.tagName).toBe('B');
    expect(inner?.classList.contains('truncate')).toBe(false);
  });

  it('leaves a component child’s own children alone', () => {
    const Wrap = ({ children }: { children?: ReactNode }) => <em data-testid="wrap">{children}</em>;
    const { container } = render(
      <DataListTextCell>
        <Wrap>inner</Wrap>
      </DataListTextCell>,
    );

    expect(screen.getByTestId('wrap').innerHTML).toBe('inner');
    expect(container.textContent).toBe('inner');
  });
});

describe('DataListNameCell and DataListDescriptionCell', () => {
  it('read at their own weight', () => {
    const name = render(<DataListNameCell>a name</DataListNameCell>);
    expect(cellOf(name.container).classList.contains('text-neutral4')).toBe(true);

    cleanup();

    const description = render(<DataListDescriptionCell>a description</DataListDescriptionCell>);
    expect(cellOf(description.container).classList.contains('text-neutral2')).toBe(true);
  });

  it('keep a caller class alongside their own', () => {
    const { container } = render(<DataListNameCell className="my-own-class">a name</DataListNameCell>);

    expect(cellOf(container).classList.contains('my-own-class')).toBe(true);
    expect(cellOf(container).classList.contains('text-neutral4')).toBe(true);
  });
});

describe('DataListRowHeaderCell', () => {
  it('pins itself to the start edge without being asked', () => {
    const { container } = render(<DataListRowHeaderCell>Row</DataListRowHeaderCell>);

    expect(cellOf(container).classList.contains('sticky')).toBe(true);
    expect(cellOf(container).classList.contains('data-list-row-header')).toBe(true);
  });

  it('truncates its text like the other text cells', () => {
    const { container } = render(<DataListRowHeaderCell>Row</DataListRowHeaderCell>);

    expect(container.querySelector('.truncate')).not.toBeNull();
    expect(container.textContent).toBe('Row');
  });
});

describe('DataListNumberCell', () => {
  it('is right-aligned with tabular figures', () => {
    const { container } = render(<DataListNumberCell>1,200</DataListNumberCell>);

    expect(cellOf(container).classList.contains('text-right')).toBe(true);
    expect(cellOf(container).classList.contains('tabular-nums')).toBe(true);
  });

  it('stands out only when highlighted', () => {
    const { container } = render(<DataListNumberCell>1,200</DataListNumberCell>);
    expect(cellOf(container).classList.contains('font-semibold')).toBe(false);
    expect(cellOf(container).classList.contains('text-neutral3')).toBe(true);

    cleanup();

    const highlighted = render(<DataListNumberCell highlight>1,200</DataListNumberCell>);
    expect(cellOf(highlighted.container).classList.contains('font-semibold')).toBe(true);
    expect(cellOf(highlighted.container).classList.contains('text-neutral4')).toBe(true);
  });
});

describe('DataListIdCell', () => {
  it('shortens a long id to its first eight characters', () => {
    const { container } = render(<DataListIdCell id="0123456789abcdef" />);

    expect(container.textContent).toBe('01234567');
  });

  it('leaves an id of exactly eight characters whole', () => {
    const { container } = render(<DataListIdCell id="01234567" />);

    expect(container.textContent).toBe('01234567');
  });

  it('leaves a short id whole', () => {
    const { container } = render(<DataListIdCell id="abc" />);

    expect(container.textContent).toBe('abc');
  });

  it('shows nothing for an id it was never given', () => {
    const { container } = render(<DataListIdCell id={undefined as unknown as string} />);

    expect(container.textContent).toBe('');
  });
});

describe('DataListSelectCell', () => {
  it('reports a plain click as an ordinary toggle', () => {
    const onToggle = vi.fn();
    render(<DataListSelectCell checked={false} onToggle={onToggle} aria-label="Select row" />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row' }));

    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('passes on a shift-click so the caller can select a range', () => {
    const onToggle = vi.fn();
    render(<DataListSelectCell checked={false} onToggle={onToggle} aria-label="Select row" />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row' }), { shiftKey: true });

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('marks the cell as selected so the host row can highlight itself', () => {
    const { container, rerender } = render(<DataListSelectCell checked={false} onToggle={() => {}} />);
    expect(container.querySelector('label')?.dataset.selected).toBeUndefined();

    rerender(<DataListSelectCell checked onToggle={() => {}} />);
    expect(container.querySelector('label')?.dataset.selected).toBe('true');
  });

  it('keeps the click off the row behind it', () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <DataListSelectCell checked={false} onToggle={vi.fn()} aria-label="Select row" />
      </div>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row' }));

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('keeps a click on the cell itself off the row behind it', () => {
    const onRowClick = vi.fn();
    const { container } = render(
      <div onClick={onRowClick}>
        <DataListSelectCell checked={false} onToggle={vi.fn()} aria-label="Select row" />
      </div>,
    );

    fireEvent.click(container.querySelector('label') as HTMLElement);

    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('ignores a click while it is disabled', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <DataListSelectCell checked={false} onToggle={onToggle} disabled aria-label="Select row" />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select row' }));

    expect(onToggle).not.toHaveBeenCalled();
    expect(container.querySelector('label')?.classList.contains('cursor-not-allowed')).toBe(true);
  });

  it('invites a click while it is not', () => {
    const { container } = render(<DataListSelectCell checked={false} onToggle={vi.fn()} aria-label="Select row" />);

    expect(container.querySelector('label')?.classList.contains('cursor-pointer')).toBe(true);
  });

  it('shows the state it was given', () => {
    render(<DataListSelectCell checked onToggle={vi.fn()} aria-label="Select row" />);

    expect(screen.getByRole('checkbox', { name: 'Select row' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('DataListDateCell', () => {
  it('says Today for today', () => {
    const { container } = render(<DataListDateCell timestamp={new Date()} />);

    expect(container.textContent).toBe('Today');
  });

  it('names the month and day for any other date', () => {
    const { container } = render(<DataListDateCell timestamp={new Date(2026, 4, 19, 12, 0, 0)} />);

    expect(container.textContent).toBe('May 19');
  });

  it('reads a date given as a string', () => {
    const { container } = render(<DataListDateCell timestamp="2026-05-19T12:00:00.000Z" />);

    expect(container.textContent).toBe('May 19');
  });

  it('shows nothing for a date it cannot read', () => {
    const { container } = render(<DataListDateCell timestamp="not a date" />);

    // The cell's own em-dash placeholder stands in, rather than "Invalid Date".
    expect(container.textContent).toBe('');
  });
});

describe('DataListCreatedCell', () => {
  it('shows date and 12-hour time without milliseconds', () => {
    const { container } = render(<DataListCreatedCell timestamp={new Date(2026, 7, 31, 13, 7, 47, 657)} />);

    expect(container.textContent).toBe('Aug 31 1:07:47 pm');
  });

  it('reads a timestamp given as a string', () => {
    const { container } = render(<DataListCreatedCell timestamp={new Date(2026, 4, 19, 9, 5, 3).toISOString()} />);

    expect(container.textContent).toBe('May 19 9:05:03 am');
  });

  it('shows nothing for a date it cannot read', () => {
    const { container } = render(<DataListCreatedCell timestamp="not a date" />);

    expect(container.textContent).toBe('');
  });
});

describe('DataListTimeCell', () => {
  it('shows 12-hour time by default', () => {
    const { container } = render(<DataListTimeCell timestamp={new Date(2026, 5, 1, 17, 9, 59, 665)} />);

    expect(container.textContent).toBe('5:09:59.665 pm');
  });

  it('pads the milliseconds to three digits', () => {
    const { container } = render(<DataListTimeCell timestamp={new Date(2026, 5, 1, 17, 9, 59, 7)} />);

    expect(container.textContent).toBe('5:09:59.007 pm');
  });

  it('reads a time given as a string', () => {
    const { container } = render(<DataListTimeCell timestamp={new Date(2026, 5, 1, 9, 5, 3, 40).toISOString()} />);

    expect(container.textContent).toBe('9:05:03.040 am');
  });

  it('shows nothing for a time it cannot read', () => {
    const { container } = render(<DataListTimeCell timestamp="not a time" />);

    expect(container.textContent).toBe('');
  });
});
