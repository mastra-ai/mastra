// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileBrowser } from '../file-browser';
import type { FileEntry } from '../../types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const recursiveEntries: FileEntry[] = [
  { name: 'src', type: 'directory' },
  { name: 'src/components', type: 'directory' },
  { name: 'src/components/Button.tsx', type: 'file', size: 1024 },
  { name: 'src/index.ts', type: 'file', size: 512 },
  { name: '.agents', type: 'directory' },
  { name: '.agents/skills', type: 'directory' },
  { name: '.agents/skills/code-review', type: 'directory' },
  { name: '.agents/skills/code-review/SKILL.md', type: 'file', size: 2048 },
  { name: 'README.md', type: 'file', size: 2048 },
];

function renderFileBrowser(
  props: Partial<React.ComponentProps<typeof FileBrowser>> & { entries?: FileEntry[]; currentPath?: string } = {},
) {
  const onNavigate = vi.fn();
  const onFileSelect = vi.fn();

  render(
    <FileBrowser
      entries={props.entries ?? recursiveEntries}
      currentPath={props.currentPath ?? '.'}
      isLoading={false}
      onNavigate={onNavigate}
      onFileSelect={onFileSelect}
      {...props}
    />,
  );

  return { onNavigate, onFileSelect };
}

function getTreeItemById(id: string) {
  const item = Array.from(document.querySelectorAll<HTMLElement>('[data-tree-item-id]')).find(
    element => element.dataset.treeItemId === id,
  );
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Missing tree item ${id}`);
  }
  return item;
}

describe('FileBrowser', () => {
  it('renders a recursive root tree without breadcrumb or parent-directory navigation', () => {
    renderFileBrowser();

    expect(screen.queryByLabelText('Workspace root')).toBeNull();
    expect(screen.queryByRole('button', { name: '..' })).toBeNull();
    expect(getTreeItemById('src')).not.toBeNull();
    expect(getTreeItemById('src/components')).not.toBeNull();
    expect(getTreeItemById('src/components/Button.tsx')).not.toBeNull();
    expect(getTreeItemById('README.md')).not.toBeNull();
  });

  it('expands and collapses nested folders in place without navigating', () => {
    const { onNavigate, onFileSelect } = renderFileBrowser();
    const src = getTreeItemById('src');

    expect(src.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(within(src).getByRole('button', { name: /src/i }));

    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('selects nested files by full path without navigating', () => {
    const { onFileSelect, onNavigate } = renderFileBrowser();

    fireEvent.click(within(getTreeItemById('src/components/Button.tsx')).getByText('Button.tsx'));

    expect(onFileSelect).toHaveBeenCalledWith('src/components/Button.tsx');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('selects files with the keyboard without navigating', () => {
    const { onFileSelect, onNavigate } = renderFileBrowser();
    const file = getTreeItemById('README.md');

    file.focus();
    fireEvent.keyDown(within(file).getByText('README.md'), { key: 'Enter' });

    expect(onFileSelect).toHaveBeenCalledWith('README.md');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('marks skills folders and files as a distinct tree location', () => {
    renderFileBrowser();

    expect(getTreeItemById('.agents/skills').dataset.workspaceTreeLocation).toBe('skills');
    expect(getTreeItemById('.agents/skills/code-review').dataset.workspaceTreeLocation).toBe('skills');
    expect(getTreeItemById('.agents/skills/code-review/SKILL.md').dataset.workspaceTreeLocation).toBe('skills');
    expect(getTreeItemById('src').dataset.workspaceTreeLocation).toBeUndefined();
  });

  it('colors skill folder and file icons with the accent color', () => {
    renderFileBrowser();

    const skillFolderIcon = getTreeItemById('.agents/skills').querySelector('svg[class*="lucide-folder"]');
    const skillFileIcon = getTreeItemById('.agents/skills/code-review/SKILL.md').querySelector('svg[class*="lucide-file"]');
    const regularFolderIcon = getTreeItemById('src').querySelector('svg[class*="lucide-folder"]');

    expect(skillFolderIcon?.getAttribute('class')).toContain('text-accent1');
    expect(skillFileIcon?.getAttribute('class')).toContain('text-accent1');
    expect(regularFolderIcon?.getAttribute('class')).not.toContain('text-accent1');
  });

  it('creates a folder at the workspace root from the header action', () => {
    const onCreateDirectory = vi.fn();

    renderFileBrowser({ onCreateDirectory });

    fireEvent.click(screen.getByRole('button', { name: /create folder at workspace root/i }));

    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'packages' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onCreateDirectory).toHaveBeenCalledWith('packages');
  });

  it('lazily loads folder children on expand and keeps folders collapsed by default', () => {
    const onLoadFolder = vi.fn();
    renderFileBrowser({
      entries: [{ name: 'src', type: 'directory' }],
      onLoadFolder,
    });

    const src = getTreeItemById('src');
    expect(src.getAttribute('aria-expanded')).toBe('false');
    expect(onLoadFolder).not.toHaveBeenCalled();

    fireEvent.click(within(src).getByRole('button', { name: /src/i }));

    expect(src.getAttribute('aria-expanded')).toBe('true');
    expect(onLoadFolder).toHaveBeenCalledWith('src');
  });

  it('creates directories inside the selected folder tree item', () => {
    const onCreateDirectory = vi.fn();

    renderFileBrowser({ onCreateDirectory });

    expect(screen.queryByRole('button', { name: /^create directory$/i })).toBeNull();
    fireEvent.click(within(getTreeItemById('src/components')).getByRole('button', { name: /create folder in components/i }));

    fireEvent.change(screen.getByLabelText('Folder name'), { target: { value: 'docs' } });
    fireEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(onCreateDirectory).toHaveBeenCalledWith('src/components/docs');
  });

  it('opens delete confirmation for nested entries without navigating or selecting', () => {
    const onDelete = vi.fn();
    const { onNavigate, onFileSelect } = renderFileBrowser({ onDelete });

    fireEvent.click(screen.getByRole('button', { name: /delete Button\.tsx/i }));

    expect(screen.getByText(/Are you sure you want to delete "src\/components\/Button\.tsx"\?/i)).not.toBeNull();
    expect(onNavigate).not.toHaveBeenCalled();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('renders mount error metadata for mount entries', () => {
    renderFileBrowser({
      entries: [
        {
          name: 'cloud-drive',
          type: 'directory',
          mount: {
            provider: 's3',
            displayName: 'S3',
            description: 'Production bucket',
            status: 'error',
            error: 'Credentials expired',
          },
        },
      ],
    });

    expect(screen.getByText('S3')).not.toBeNull();
    expect(getTreeItemById('cloud-drive')).not.toBeNull();
  });
});
