// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Files } from './files';

class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function getTreeItem(label: string): HTMLElement {
  const item = screen
    .getAllByText(label)
    .map(element => element.closest('[role="treeitem"]'))
    .find(element => element instanceof HTMLElement);
  if (!(item instanceof HTMLElement)) {
    throw new Error(`Could not find tree item for ${label}`);
  }
  return item;
}

function renderFiles({ selectedPath = 'README.md', onSelect = vi.fn() } = {}) {
  render(
    <Files selectedPath={selectedPath} onSelect={onSelect}>
      <Files.FileTree aria-label="Project files" header={<span>Files</span>}>
        <Files.Folder id="src" label="src" defaultOpen>
          <Files.Folder id="src/components" label="components" defaultOpen>
            <Files.File id="src/components/Button.tsx" label="Button.tsx" />
          </Files.Folder>
          <Files.File id="src/index.ts" label="index.ts" />
        </Files.Folder>
        <Files.File id="README.md" label="README.md" />
      </Files.FileTree>
      <Files.FilePreview path={selectedPath} content="# Project" />
    </Files>,
  );

  return { onSelect };
}

describe('Files', () => {
  describe('when a declarative file tree is rendered', () => {
    it('selects files by their opaque full path', async () => {
      const { onSelect } = renderFiles();

      fireEvent.click(screen.getByText('Button.tsx'));

      expect(onSelect).toHaveBeenCalledWith('src/components/Button.tsx');
    });

    it('reflects the controlled selected path', () => {
      renderFiles();

      expect(getTreeItem('README.md').getAttribute('aria-selected')).toBe('true');
      expect(getTreeItem('Button.tsx').getAttribute('aria-selected')).toBeNull();
    });

    it('expands and collapses nested folders without selecting them', async () => {
      const { onSelect } = renderFiles();
      const folder = getTreeItem('components');

      fireEvent.click(within(folder).getByRole('button', { name: /components/i }));

      expect(folder.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByText('Button.tsx')).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('selects files with the keyboard', () => {
      const { onSelect } = renderFiles();
      const file = getTreeItem('index.ts');

      file.focus();
      fireEvent.keyDown(file, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('src/index.ts');
    });
  });

  describe('when callers decorate tree rows', () => {
    it('renders custom icons, metadata, and actions without triggering selection', async () => {
      const onSelect = vi.fn();
      const onAction = vi.fn();

      render(
        <Files selectedPath={undefined} onSelect={onSelect}>
          <Files.FileTree>
            <Files.File
              id="package.json"
              label="package.json"
              icon={<span>JSON icon</span>}
              metadata={<span>2 KB</span>}
              actions={<button onClick={onAction}>Delete package.json</button>}
            />
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      expect(screen.getByText('JSON icon')).not.toBeNull();
      expect(screen.getByText('2 KB')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Delete package.json' }));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('when a folder loads its children lazily', () => {
    it('requests the folder once it is opened and exposes its loading state', async () => {
      const onLoad = vi.fn();

      render(
        <Files selectedPath={undefined} onSelect={() => {}}>
          <Files.FileTree>
            <Files.Folder id="remote" label="remote" onLoad={onLoad} loading>
              <Files.File id="remote/file.txt" label="file.txt" />
            </Files.Folder>
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      fireEvent.click(within(getTreeItem('remote')).getByRole('button', { name: /remote/i }));

      expect(onLoad).toHaveBeenCalledWith('remote');
      expect(screen.getByLabelText('Loading remote')).not.toBeNull();
    });
  });

  describe('when the file tree has no content to show', () => {
    it.each([
      ['loading', { loading: true }, 'Loading files'],
      ['error', { error: 'Could not load files' }, 'Could not load files'],
      ['empty', { empty: 'No files yet' }, 'No files yet'],
    ])('renders the %s state', (_state, props, expectedText) => {
      render(
        <Files selectedPath={undefined} onSelect={() => {}}>
          <Files.FileTree {...props} />
          <Files.FilePreview />
        </Files>,
      );

      expect(screen.getByText(expectedText)).not.toBeNull();
    });
  });

  describe('when tree and preview panels are composed', () => {
    it('renders an accessible resize separator between them', () => {
      renderFiles();

      expect(screen.getByRole('separator')).not.toBeNull();
    });
  });

  describe('when markdown content is previewed', () => {
    it('renders the document without its YAML frontmatter', () => {
      render(
        <Files selectedPath="guide.md" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="guide.md" content={'---\ntitle: Hidden metadata\n---\n# Visible guide'} />
        </Files>,
      );

      expect(screen.getByRole('heading', { name: 'Visible guide' })).not.toBeNull();
      expect(screen.queryByText('title: Hidden metadata')).toBeNull();
    });

    it('switches to the complete markdown source', async () => {
      render(
        <Files selectedPath="guide.md" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="guide.md" content={'---\ntitle: Metadata\n---\n# Guide'} />
        </Files>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Source' }));

      expect(screen.getByText(/title: Metadata/)).not.toBeNull();
    });
  });

  describe('when built-in file types are previewed', () => {
    it.each([
      ['code', 'index.ts', 'export const answer = 42;', undefined],
      ['plain text', 'notes.txt', 'remember this', 'text/plain'],
    ])('renders %s content', (_kind, path, content, mimeType) => {
      render(
        <Files selectedPath={path} onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path={path} content={content} mimeType={mimeType} />
        </Files>,
      );

      expect(screen.getByText(content)).not.toBeNull();
    });

    it('renders image content as an image preview', () => {
      render(
        <Files selectedPath="logo.png" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="logo.png" content="aGVsbG8=" mimeType="image/png" />
        </Files>,
      );

      expect(screen.getByRole('img', { name: 'logo.png' }).getAttribute('src')).toBe('data:image/png;base64,aGVsbG8=');
    });
  });

  describe('when preview actions are used', () => {
    it('copies the current file content', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

      render(
        <Files selectedPath="notes.txt" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="notes.txt" content="copy me" />
        </Files>,
      );

      fireEvent.click(screen.getByRole('button', { name: /copy/i }));

      expect(writeText).toHaveBeenCalledWith('copy me');
    });
  });

  describe('when callers provide a custom preview body', () => {
    it('renders the custom content instead of a built-in renderer', () => {
      render(
        <Files selectedPath="skill.md" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="skill.md" content="# Ignored">
            <div>Skill details</div>
          </Files.FilePreview>
        </Files>,
      );

      expect(screen.getByText('Skill details')).not.toBeNull();
      expect(screen.queryByText('Ignored')).toBeNull();
    });
  });
});
