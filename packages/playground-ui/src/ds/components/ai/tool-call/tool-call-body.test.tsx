// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '../../Tooltip';
import { ToolCallArguments } from './tool-call-arguments';
import { ToolCallOutput } from './tool-call-output';

afterEach(cleanup);

describe('Tool call body', () => {
  describe('when output is longer than the preview limit', () => {
    it('copies the complete output instead of the shortened preview', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const text = 'Long output\n'.repeat(100);
      render(
        <TooltipProvider>
          <ToolCallOutput text={text} maxLength={800} data-testid="output" />
        </TooltipProvider>,
      );

      expect(screen.getByTestId('output').textContent).toBe(`${text.slice(0, 800)}…`);
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
      await screen.findByRole('button', { name: 'Copied!' });
      expect(writeText).toHaveBeenCalledWith(text);
    });
  });

  describe('when an edit has no generic arguments section', () => {
    it('still shows the file change', () => {
      render(
        <ToolCallArguments
          toolName="edit_file"
          args={{ path: 'file.ts', old_string: 'before', new_string: 'after' }}
          hideArguments
        />,
      );

      expect(screen.getByRole('group', { name: 'File change' }).textContent).toBe('-before+after');
    });
  });

  describe('when only streamed argument text is available', () => {
    it('preserves the partial text until structured arguments arrive', () => {
      const { rerender } = render(
        <TooltipProvider>
          <ToolCallArguments toolName="search" args={undefined} argsText={'{"query":"par'} />
        </TooltipProvider>,
      );
      expect(screen.getByText('{"query":"par')).toBeTruthy();

      rerender(
        <TooltipProvider>
          <ToolCallArguments toolName="search" args={{ query: 'paris' }} argsText={'{"query":"par'} />
        </TooltipProvider>,
      );
      expect(screen.getByText(/"query": "paris"/)).toBeTruthy();
      expect(screen.queryByText('{"query":"par')).toBeNull();
    });
  });
});
