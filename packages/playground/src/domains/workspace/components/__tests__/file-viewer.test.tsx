// @vitest-environment jsdom
import { ThemeProvider } from '@mastra/playground-ui/components/ThemeProvider';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import '@/index.css';
import { FileViewer } from '../file-browser';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('FileViewer', () => {
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
      const { container } = render(
        <ThemeProvider defaultTheme="light" storageKey="file-viewer-highlight-theme">
          <FileViewer path="config.json" content={'{"enabled": true}'} isLoading={false} />
        </ThemeProvider>,
      );
      const code = container.querySelector<HTMLElement>('pre code');

      if (!code) {
        throw new Error('Expected highlighted code to render.');
      }

      expect(getComputedStyle(code).color).toBe('rgb(17, 27, 39)');
    });
  });
});
