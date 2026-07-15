// @vitest-environment jsdom
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import '@/index.css';
import { FileViewer, type FileViewerProps } from '../file-browser';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const markdown = '# Hello Heading\n\nSome body copy.';

function renderFileViewer(props: FileViewerProps, theme: 'light' | 'dark' = 'dark') {
  return render(
    <ThemeProvider defaultTheme={theme} storageKey="file-viewer-theme">
      <FileViewer {...props} />
    </ThemeProvider>,
  );
}

describe('FileViewer', () => {
  describe('when markdown content is loaded', () => {
    it('renders markdown formatted by default with the Rendered toggle active', async () => {
      renderFileViewer({ path: 'docs/README.md', content: markdown, isLoading: false, mimeType: 'text/markdown' });

      expect(await screen.findByText('Hello Heading')).not.toBeNull();

      const renderedToggle = screen.getByRole('button', { name: /rendered/i });
      expect(renderedToggle.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: /source/i }).getAttribute('aria-pressed')).toBe('false');
    });

    it('switches to raw source when the Source toggle is clicked', () => {
      renderFileViewer({ path: 'docs/README.md', content: markdown, isLoading: false, mimeType: 'text/markdown' });

      fireEvent.click(screen.getByRole('button', { name: /source/i }));

      expect(screen.getByRole('button', { name: /source/i }).getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('button', { name: /rendered/i }).getAttribute('aria-pressed')).toBe('false');
    });

    it('strips YAML frontmatter from the rendered markdown', async () => {
      const withFrontmatter = '---\nname: find-skills\ndescription: A test skill\n---\n\n# Find Skills\n\nBody text.';
      renderFileViewer({ path: 'docs/SKILL.md', content: withFrontmatter, isLoading: false, mimeType: 'text/markdown' });

      expect(await screen.findByText('Find Skills')).not.toBeNull();
      expect(screen.queryByText(/description: A test skill/)).toBeNull();
      expect(screen.queryByText(/name: find-skills/)).toBeNull();
    });
  });

  describe('when non-markdown content is loaded', () => {
    it('does not show a markdown toggle', () => {
      renderFileViewer({ path: 'src/index.ts', content: 'const x = 1;', isLoading: false });

      expect(screen.queryByRole('button', { name: /rendered/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /source/i })).toBeNull();
    });
  });

  describe('when the light theme is active', () => {
    it('renders plain text on the themed surface', () => {
      render(
        <ThemeProvider defaultTheme="light" storageKey="file-viewer-plain-text-theme">
          <div data-testid="surface-reference" className="bg-surface2" />
          <FileViewer path="hello.txt" content="hello" isLoading={false} />
        </ThemeProvider>,
      );

      const content = screen.getByText('hello');
      const viewerSurface = content.parentElement;

      if (!viewerSurface) {
        throw new Error('Expected the file content to render inside the viewer surface.');
      }

      const expectedBackground = getComputedStyle(screen.getByTestId('surface-reference')).backgroundColor;
      expect(getComputedStyle(viewerSurface).backgroundColor).toBe(expectedBackground);
      expect(expectedBackground).not.toBe('rgb(0, 0, 0)');
    });

    it('uses a light syntax-highlighting palette', () => {
      const { container } = renderFileViewer(
        { path: 'config.ts', content: 'export const enabled = true;', isLoading: false },
        'light',
      );
      const code = container.querySelector<HTMLElement>('pre code');

      if (!code) {
        throw new Error('Expected highlighted code to render.');
      }

      expect(getComputedStyle(code).color).toBe('rgb(17, 27, 39)');
    });
  });
});
