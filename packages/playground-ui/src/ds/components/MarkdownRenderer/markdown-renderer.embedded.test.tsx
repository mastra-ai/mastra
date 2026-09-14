// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../Tooltip';
import { MarkdownRenderer } from './markdown-renderer';

afterEach(cleanup);

describe('MarkdownRenderer', () => {
  describe('when code blocks are embedded in a document', () => {
    it('preserves indented instructions without a separate copy control', () => {
      const { container } = render(
        <TooltipProvider>
          <MarkdownRenderer codeBlockVariant="embedded">
            {'Follow these instructions.\n\n    Ask for a location.\n    Keep responses concise.'}
          </MarkdownRenderer>
        </TooltipProvider>,
      );

      expect(container.querySelector('pre')?.textContent).toBe('Ask for a location.\nKeep responses concise.');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });
});
