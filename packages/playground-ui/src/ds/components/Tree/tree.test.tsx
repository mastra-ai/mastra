// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tree, flattenTreeRows } from './tree';

afterEach(cleanup);

interface Node {
  name: string;
  children?: Node[];
}

const project: Node[] = [
  { name: 'src', children: [{ name: 'index.ts' }, { name: 'utils.ts' }, { name: 'empty', children: [] }] },
  { name: 'package.json' },
  { name: 'README.md' },
];

const logs = (count: number): Node[] => [
  { name: 'logs', children: Array.from({ length: count }, (_, i) => ({ name: `run-${String(i).padStart(4, '0')}` })) },
];

function ProjectTree({
  nodes = project,
  initialOpen = ['src'],
  onActivate = vi.fn(),
}: {
  nodes?: Node[];
  initialOpen?: string[];
  onActivate?: (id: string) => void;
}) {
  const [open, setOpen] = useState<string[]>(initialOpen);
  const [selected, setSelected] = useState<string>();
  const setFolderOpen = (id: string, expanded: boolean) =>
    setOpen(current => (expanded ? [...current, id] : current.filter(item => item !== id)));
  return (
    <Tree
      aria-label="Files"
      rows={flattenTreeRows(nodes, {
        getId: node => node.name,
        getChildren: node => node.children,
        isOpen: id => open.includes(id),
      })}
      getRowLabel={row => row.node.name}
      selectedId={selected}
      onActivate={row => {
        onActivate(row.id);
        if (row.expanded === undefined) setSelected(row.id);
        else setFolderOpen(row.id, !row.expanded);
      }}
      onExpandedChange={(row, expanded) => setFolderOpen(row.id, expanded)}
      renderRow={row => (
        <>
          <Tree.Label>{row.node.name}</Tree.Label>
          <button type="button">Delete {row.node.name}</button>
        </>
      )}
    />
  );
}

const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}`) });

const files = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `file-${index}`,
    level: 0,
    posInSet: index + 1,
    setSize: count,
  }));

function SelectedTree({
  rows,
  selectedId,
  onActivate,
}: {
  rows: ReturnType<typeof files>;
  selectedId?: string;
  onActivate?: (id: string) => void;
}) {
  const [activated, setActivated] = useState<{ id: string; over?: string }>();
  return (
    <Tree
      aria-label="Files"
      rows={rows}
      getRowLabel={row => row.id}
      selectedId={activated && activated.over === selectedId ? activated.id : selectedId}
      onActivate={row => {
        setActivated({ id: row.id, over: selectedId });
        onActivate?.(row.id);
      }}
      onExpandedChange={() => {}}
      renderRow={row => (
        <>
          <Tree.Label>{row.id}</Tree.Label>
          <button type="button" aria-label={`Delete ${row.id}`}>
            <svg>
              <path data-testid={`icon-${row.id}`} d="M0 0h1v1z" />
            </svg>
          </button>
        </>
      )}
    />
  );
}

function revealScrolls(container: HTMLElement, height: number) {
  const viewport = container.querySelector('[role="tree"]')?.parentElement?.parentElement;
  if (!viewport) throw new Error('no viewport');
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: height });
  const scrollTo = vi.spyOn(Element.prototype, 'scrollTo');
  return {
    viewport,
    scrolls: () =>
      scrollTo.mock.calls.filter((_, call) => scrollTo.mock.contexts[call] === viewport).map(([options]) => options),
  };
}

describe('Tree selection reveal', () => {
  afterEach(() => vi.restoreAllMocks());

  it('brings a row selected from elsewhere a third of the way down the view', () => {
    const { container, rerender } = render(<SelectedTree rows={files(200)} />);
    const scrolls = revealScrolls(container, 300);
    rerender(<SelectedTree rows={files(200)} selectedId="file-100" />);
    expect(scrolls.scrolls()).toEqual([expect.objectContaining({ top: 100 * 28 - 100 })]);
  });

  it('leaves a selected row that is already comfortably in view where it is', () => {
    const { container, rerender } = render(<SelectedTree rows={files(200)} />);
    const scrolls = revealScrolls(container, 300);
    rerender(<SelectedTree rows={files(200)} selectedId="file-3" />);
    expect(scrolls.scrolls()).toEqual([]);
  });

  it('does not scroll a row the user just clicked', () => {
    const { container } = render(<SelectedTree rows={files(200)} />);
    const scrolls = revealScrolls(container, 300);
    fireEvent.click(item('file-9'));
    expect(item('file-9').getAttribute('aria-selected')).toBe('true');
    expect(scrolls.scrolls()).toEqual([]);
  });

  it('reveals it again when rows load above it, but only until the user scrolls', () => {
    const { container, rerender } = render(<SelectedTree rows={files(200)} selectedId="file-100" />);
    const scrolls = revealScrolls(container, 300);
    const grown = [...files(20).map(row => ({ ...row, id: `new-${row.id}` })), ...files(200)];
    rerender(<SelectedTree rows={grown} selectedId="file-100" />);
    expect(scrolls.scrolls()).toEqual([expect.objectContaining({ top: 120 * 28 - 100 })]);

    fireEvent.wheel(scrolls.viewport);
    rerender(
      <SelectedTree
        rows={[...files(5).map(row => ({ ...row, id: `top-${row.id}` })), ...grown]}
        selectedId="file-100"
      />,
    );
    expect(scrolls.scrolls()).toHaveLength(1);
  });

  it('waits for a row selected before it loads, but not once the user has scrolled', () => {
    const { container, rerender } = render(<SelectedTree rows={files(50)} />);
    const scrolls = revealScrolls(container, 300);
    rerender(<SelectedTree rows={files(50)} selectedId="file-150" />);
    fireEvent.wheel(scrolls.viewport);
    rerender(<SelectedTree rows={files(200)} selectedId="file-150" />);
    expect(scrolls.scrolls()).toEqual([]);
  });

  it('reveals a row selected elsewhere even if it was the last one clicked in the tree', () => {
    const { container, rerender } = render(<SelectedTree rows={files(200)} />);
    const scrolls = revealScrolls(container, 300);
    fireEvent.click(item('file-20'));
    rerender(<SelectedTree rows={files(200)} selectedId="file-3" />);
    rerender(<SelectedTree rows={files(200)} selectedId="file-20" />);
    expect(scrolls.scrolls()).toEqual([expect.objectContaining({ top: 20 * 28 - 100 })]);
  });

  it('scrolls once per selection, not on every render', () => {
    const { container, rerender } = render(<SelectedTree rows={files(200)} />);
    const scrolls = revealScrolls(container, 300);
    rerender(<SelectedTree rows={files(200)} selectedId="file-100" />);
    rerender(<SelectedTree rows={files(200)} selectedId="file-100" />);
    expect(scrolls.scrolls()).toHaveLength(1);
  });
});

describe('Tree focus and activation', () => {
  it('keeps focus on a row that rows loading above it push past a hundred', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SelectedTree rows={files(100)} />);
    item('file-0').focus();
    await user.keyboard('{End}');
    const focused = item('file-99');
    expect(document.activeElement).toBe(focused);

    rerender(<SelectedTree rows={[{ id: 'new', level: 0, posInSet: 1, setSize: 101 }, ...files(100)]} />);

    expect(item('file-99')).toBe(focused);
    expect(document.activeElement).toBe(focused);
  });

  it('activates a row with Space right after the page loads', () => {
    const onActivate = vi.fn();
    render(<SelectedTree rows={files(3)} onActivate={onActivate} />);
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    Object.defineProperty(space, 'timeStamp', { value: 100 });
    act(() => item('file-1').dispatchEvent(space));
    expect(onActivate).toHaveBeenCalledWith('file-1');
  });

  it('does not activate a row when an icon inside one of its buttons is clicked', () => {
    const onActivate = vi.fn();
    render(<SelectedTree rows={files(3)} onActivate={onActivate} />);
    fireEvent.click(screen.getByTestId('icon-file-1'));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('does not pull focus back after the user tabs out of the tree', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <SelectedTree rows={files(3)} />
        <button type="button">Outside</button>
      </>,
    );
    item('file-0').focus();
    await user.keyboard('{ArrowUp}');
    const outside = screen.getByRole('button', { name: 'Outside' });
    act(() => outside.focus());
    rerender(
      <>
        <SelectedTree rows={files(4)} />
        <button type="button">Outside</button>
      </>,
    );
    expect(document.activeElement).toBe(outside);
  });
});

describe('Tree', () => {
  it('describes each row’s level and place, with one tab stop', () => {
    render(<ProjectTree />);

    expect(item('index.ts').getAttribute('aria-level')).toBe('2');
    expect([item('utils.ts').getAttribute('aria-posinset'), item('utils.ts').getAttribute('aria-setsize')]).toEqual([
      '2',
      '3',
    ]);
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    expect(item('README.md').hasAttribute('aria-expanded')).toBe(false);
    expect(screen.getAllByRole('treeitem').filter(row => row.tabIndex === 0)).toEqual([item('src')]);
  });

  it('moves through rows with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    render(<ProjectTree />);

    item('src').focus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(item('utils.ts'));
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(item('README.md'));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(item('src'));
    expect(item('src').tabIndex).toBe(0);
  });

  it('opens, enters, leaves and closes folders with Right and Left', async () => {
    const user = userEvent.setup();
    render(<ProjectTree initialOpen={[]} />);

    item('src').focus();
    await user.keyboard('{ArrowRight}');
    expect(item('src').getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(item('index.ts'));
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(item('src'));
    await user.keyboard('{ArrowLeft}');
    expect(item('src').getAttribute('aria-expanded')).toBe('false');
  });

  it('opens and closes a folder from its chevron without activating it', () => {
    const onActivate = vi.fn();
    render(<ProjectTree onActivate={onActivate} />);

    const chevron = item('src').querySelector('[data-tree-toggle]');
    if (!chevron) throw new Error('no chevron');
    fireEvent.click(chevron);
    expect(item('src').getAttribute('aria-expanded')).toBe('false');
    expect(onActivate).not.toHaveBeenCalled();
    expect(item('README.md').querySelector('[data-tree-toggle]')).toBeNull();
  });

  it('stays on an open, empty folder when Right is pressed', async () => {
    const user = userEvent.setup();
    render(<ProjectTree initialOpen={['src', 'empty']} />);

    item('empty').focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(item('empty'));
  });

  it('activates a row once with Enter, Space or a click, but not through a button inside it', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<ProjectTree onActivate={onActivate} />);

    item('index.ts').focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(screen.getByText('README.md'));
    expect(onActivate.mock.calls).toEqual([['index.ts'], ['index.ts'], ['README.md']]);
    expect(item('README.md').getAttribute('aria-selected')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Delete utils.ts' }));
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it('jumps to a row by typing the start of its name, reading quick keys as one name', async () => {
    const user = userEvent.setup();
    render(<ProjectTree />);

    item('src').focus();
    await user.keyboard('p');
    expect(document.activeElement).toBe(item('package.json'));
    await user.keyboard('r');
    expect(document.activeElement).toBe(item('package.json'));
    await new Promise(resolve => setTimeout(resolve, 600));
    await user.keyboard('ut');
    expect(document.activeElement).toBe(item('utils.ts'));
    await new Promise(resolve => setTimeout(resolve, 600));
    await user.keyboard('rr');
    expect(document.activeElement).toBe(item('README.md'));
  });

  it('jumps to a row that isn’t drawn yet', async () => {
    const user = userEvent.setup();
    render(<ProjectTree nodes={logs(500)} initialOpen={['logs']} />);

    expect(screen.queryByRole('treeitem', { name: /^run-0420/ })).toBeNull();
    item('logs').focus();
    await user.keyboard('run-042');
    expect(document.activeElement).toBe(item('run-0420'));
  });

  it('draws only the rows in view, keeping the rest findable with the browser’s find in page', () => {
    const { container } = render(<ProjectTree nodes={logs(500)} initialOpen={['logs']} />);

    expect(screen.getAllByRole('treeitem').length).toBeLessThan(60);
    const findable = [...container.querySelectorAll('[data-tree-find-index]')];
    expect(findable.length + screen.getAllByRole('treeitem').length).toBe(501);
    expect(findable.every(element => element.getAttribute('hidden') === 'until-found')).toBe(true);
    expect(findable.at(-1)?.textContent).toBe('run-0499');
  });

  it('marks the row the browser found, once it scrolls into view', async () => {
    const { container } = render(<ProjectTree nodes={logs(500)} initialOpen={['logs']} />);
    const target = [...container.querySelectorAll('[data-tree-find-index]')].find(
      element => element.textContent === 'run-0300',
    );
    const viewport = container.querySelector('[role="tree"]')?.parentElement?.parentElement;
    if (!target || !viewport) throw new Error('missing find text or viewport');

    fireEvent(target, new Event('beforematch', { bubbles: true }));
    target.removeAttribute('hidden');
    Object.defineProperty(viewport, 'scrollTop', { configurable: true, value: 301 * 28 });
    await act(async () => fireEvent.scroll(viewport));

    expect(item('run-0300').hasAttribute('data-found')).toBe(true);
    fireEvent.pointerDown(item('run-0300'));
    expect(item('run-0300').hasAttribute('data-found')).toBe(false);
    expect(container.querySelectorAll('[data-tree-find-index]:not([hidden])')).toHaveLength(0);
  });
});
