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

  describe('when file rows are presented', () => {
    it('uses compact semibold labels', () => {
      renderFiles();

      expect(screen.getByText('Files').parentElement?.className).toContain('text-xs');
      expect(within(getTreeItem('Button.tsx')).getByText('Button.tsx').className).toContain('text-xs');
      expect(within(getTreeItem('Button.tsx')).getByText('Button.tsx').className).toContain('font-semibold');
    });

    it('automatically distinguishes known and unknown file types with colored and neutral icons', () => {
      render(
        <Files>
          <Files.FileTree>
            <Files.File id="src/index.ts" label="index.ts" />
            <Files.File id="archive.custom" label="archive.custom" />
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      expect(within(getTreeItem('index.ts')).getByTestId('file-icon-typescript').getAttribute('class')).toMatch(
        /text-blue/,
      );
      expect(within(getTreeItem('archive.custom')).getByTestId('file-icon-generic').getAttribute('class')).toMatch(
        /text-neutral/,
      );
    });

    it('preserves an explicit caller-provided icon', () => {
      render(
        <Files>
          <Files.FileTree>
            <Files.File id="package.json" label="package.json" icon={<span>Custom JSON icon</span>} />
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      expect(screen.getByText('Custom JSON icon')).not.toBeNull();
      expect(screen.queryByTestId('file-icon-json')).toBeNull();
    });
  });

  describe('when callers provide tree row actions', () => {
    it('hides actions behind an accessible menu and does not select the row when an action is used', async () => {
      const onSelect = vi.fn();
      const onAction = vi.fn();

      render(
        <Files selectedPath={undefined} onSelect={onSelect}>
          <Files.FileTree>
            <Files.File
              id="package.json"
              label="package.json"
              metadata={<span>2 KB</span>}
              actions={<button onClick={onAction}>Delete package.json</button>}
            />
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      const metadata = screen.getByText('2 KB');
      const actionTrigger = screen.getByRole('button', { name: 'Actions for package.json' });
      expect(metadata.parentElement?.parentElement).toBe(actionTrigger.parentElement);
      expect(metadata.parentElement?.parentElement?.className).toContain('gap-1');
      expect(screen.queryByRole('button', { name: 'Delete package.json' })).toBeNull();

      fireEvent.click(actionTrigger);
      fireEvent.click(await screen.findByRole('button', { name: 'Delete package.json' }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('does not collapse a folder when its action menu is opened', () => {
      render(
        <Files>
          <Files.FileTree>
            <Files.Folder id="src" label="src" defaultOpen actions={<button>Delete src</button>}>
              <Files.File id="src/index.ts" label="index.ts" />
            </Files.Folder>
          </Files.FileTree>
          <Files.FilePreview />
        </Files>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Actions for src' }));

      expect(getTreeItem('src').getAttribute('aria-expanded')).toBe('true');
      expect(screen.getByText('index.ts')).not.toBeNull();
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

    it('preserves caller-defined panel IDs for persisted resize layouts', () => {
      render(
        <Files>
          <Files.FileTree id="file-tree-panel" />
          <Files.FilePreview id="file-preview-panel" />
        </Files>,
      );

      expect(document.getElementById('file-tree-panel')).not.toBeNull();
      expect(document.getElementById('file-preview-panel')).not.toBeNull();
    });
  });

  describe('when a file is previewed', () => {
    it('does not show an automatic file-type icon for a root file', () => {
      render(
        <Files>
          <Files.FileTree />
          <Files.FilePreview path="README.md" content="# Project" />
        </Files>,
      );

      expect(screen.queryByTestId('file-icon-markdown')).toBeNull();
    });

    it('shows every nested path segment with stronger folder hierarchy and a leading folder icon', () => {
      render(
        <Files>
          <Files.FileTree />
          <Files.FilePreview path="src/components/forms/Button.tsx" content="export const Button = () => null;" />
        </Files>,
      );

      const breadcrumb = screen.getByLabelText('File path');
      expect(within(breadcrumb).getByTestId('file-breadcrumb-folder-icon')).not.toBeNull();
      expect(within(breadcrumb).getByText('src').className).toContain('text-neutral4');
      expect(within(breadcrumb).getByText('components').className).toContain('text-neutral4');
      expect(within(breadcrumb).getByText('forms').className).toContain('text-neutral4');
      expect(within(breadcrumb).getByText('Button.tsx').className).toContain('text-neutral6');
      expect(within(breadcrumb).getByText('Button.tsx').className).toContain('font-semibold');
      expect(breadcrumb.textContent).toContain('srccomponentsformsButton.tsx');
      expect(breadcrumb.className).toContain('text-xs');
      expect(breadcrumb.querySelector('.truncate')).toBeNull();
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

    it('shows markdown view switching and copy directly in the breadcrumb line', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

      render(
        <Files selectedPath="guide.md" onSelect={() => {}}>
          <Files.FileTree />
          <Files.FilePreview path="guide.md" content={'---\ntitle: Metadata\n---\n# Guide'} />
        </Files>,
      );

      expect(screen.queryByRole('button', { name: 'Preview actions' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Rendered' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(screen.getByRole('button', { name: 'Source' }));

      expect(screen.getByRole('button', { name: 'Rendered' }).getAttribute('aria-pressed')).toBe('false');
      expect(screen.getByRole('button', { name: 'Source' }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByText(/title: Metadata/)).not.toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Copy file content' }));
      expect(writeText).toHaveBeenCalledWith('---\ntitle: Metadata\n---\n# Guide');
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

      fireEvent.click(screen.getByRole('button', { name: 'Copy file content' }));

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
