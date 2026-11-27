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
