// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Tree } from './tree';

afterEach(() => {
  cleanup();
});

function getTreeItem(label: string): HTMLElement {
  const item = screen.getByText(label).closest('[role="treeitem"]');
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Could not find tree item for ${label}`);
  }
  return item;
}

function renderProjectTree({ defaultOpen = true, onSelect = vi.fn() } = {}) {
  return render(
    <Tree onSelect={onSelect}>
      <Tree.Folder id="src" defaultOpen={defaultOpen}>
        <Tree.FolderTrigger>
          <Tree.Icon>
            <span aria-hidden="true">/</span>
          </Tree.Icon>
          <Tree.Label>src</Tree.Label>
        </Tree.FolderTrigger>
        <Tree.FolderContent>
          <Tree.File id="src/index.ts">
            <Tree.Icon>
              <span aria-hidden="true">-</span>
            </Tree.Icon>
            <Tree.Label>index.ts</Tree.Label>
          </Tree.File>
          <Tree.File id="src/utils.ts">
            <Tree.Icon>
              <span aria-hidden="true">-</span>
            </Tree.Icon>
            <Tree.Label>utils.ts</Tree.Label>
          </Tree.File>
        </Tree.FolderContent>
      </Tree.Folder>
      <Tree.File id="package.json">
        <Tree.Icon>
          <span aria-hidden="true">-</span>
        </Tree.Icon>
        <Tree.Label>package.json</Tree.Label>
      </Tree.File>
    </Tree>,
  );
}

describe('Tree', () => {
  it('sets tree item metadata and a single initial tab stop', () => {
    renderProjectTree();

    const src = getTreeItem('src');
    const index = getTreeItem('index.ts');
    const utils = getTreeItem('utils.ts');
    const packageJson = getTreeItem('package.json');

    expect(src.getAttribute('aria-level')).toBe('1');
    expect(src.getAttribute('aria-posinset')).toBe('1');
    expect(src.getAttribute('aria-setsize')).toBe('2');
    expect(index.getAttribute('aria-level')).toBe('2');
    expect(index.getAttribute('aria-posinset')).toBe('1');
    expect(index.getAttribute('aria-setsize')).toBe('2');
    expect(utils.getAttribute('aria-posinset')).toBe('2');
    expect(packageJson.getAttribute('aria-level')).toBe('1');
    expect(packageJson.getAttribute('aria-posinset')).toBe('2');
    expect(packageJson.getAttribute('aria-setsize')).toBe('2');

    expect(src.tabIndex).toBe(0);
    expect(index.tabIndex).toBe(-1);
    expect(utils.tabIndex).toBe(-1);
    expect(packageJson.tabIndex).toBe(-1);
  });

  it('uses neutral focus styles without accent rings', () => {
    const { container } = render(
      <Tree>
        <Tree.Folder id="src" defaultOpen>
          <Tree.FolderTrigger>
            <Tree.Label>src</Tree.Label>
          </Tree.FolderTrigger>
          <Tree.FolderContent>
            <Tree.File id="src/index.ts">
              <Tree.Label>index.ts</Tree.Label>
            </Tree.File>
            <Tree.Input type="file" onSubmit={vi.fn()} />
          </Tree.FolderContent>
        </Tree.Folder>
      </Tree>,
    );

    const folderRow = container.querySelector('[data-tree-folder-row="true"]');
    const fileItem = getTreeItem('index.ts');
    const inputItem = container.querySelector('[data-tree-item-kind="input"]');

    expect(folderRow?.className).toContain('group-focus-visible/treeitem:bg-surface4');
    expect(folderRow?.className).not.toContain('ring-accent1');
    expect(folderRow?.className).not.toContain('shadow-focus-ring');

    expect(fileItem.className).toContain('focus-visible:bg-surface4');
    expect(fileItem.className).not.toContain('ring-accent1');
    expect(fileItem.className).not.toContain('shadow-focus-ring');

    expect(inputItem?.className).toContain('focus-within:bg-surface4');
    expect(inputItem?.className).not.toContain('ring-accent1');
    expect(inputItem?.className).not.toContain('shadow-focus-ring');
  });

  it('moves focus through visible items with arrow, home, and end keys', () => {
    renderProjectTree();

    const src = getTreeItem('src');
    const index = getTreeItem('index.ts');
    const packageJson = getTreeItem('package.json');

    src.focus();
    fireEvent.keyDown(src, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(index);
    expect(index.tabIndex).toBe(0);
    expect(src.tabIndex).toBe(-1);

    fireEvent.keyDown(index, { key: 'End' });
    expect(document.activeElement).toBe(packageJson);

    fireEvent.keyDown(packageJson, { key: 'Home' });
    expect(document.activeElement).toBe(src);
  });

  it('expands, enters, exits, and collapses folders with arrow keys', () => {
    renderProjectTree({ defaultOpen: false });

    const src = getTreeItem('src');
    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('index.ts')).toBeNull();

    src.focus();
    fireEvent.keyDown(src, { key: 'ArrowRight' });
    expect(src.getAttribute('aria-expanded')).toBe('true');

    const index = getTreeItem('index.ts');
    fireEvent.keyDown(src, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(index);

    fireEvent.keyDown(index, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(src);

    fireEvent.keyDown(src, { key: 'ArrowLeft' });
    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('index.ts')).toBeNull();
  });

  it('selects files with Enter and Space without double-calling onSelect', () => {
    const onSelect = vi.fn();
    renderProjectTree({ onSelect });

    const index = getTreeItem('index.ts');
    index.focus();

    fireEvent.keyDown(index, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('src/index.ts');

    fireEvent.keyDown(index, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenLastCalledWith('src/index.ts');
  });
});
