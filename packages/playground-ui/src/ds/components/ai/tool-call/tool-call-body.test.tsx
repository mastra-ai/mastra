// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '../../Tooltip';
import { ToolCallArguments } from './tool-call-arguments';

afterEach(cleanup);

describe('Tool call body', () => {
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
          <ToolCallArguments toolName="search" args={undefined} argsText='{"query":"par' />
        </TooltipProvider>,
      );
      expect(screen.getByText('{"query":"par')).toBeTruthy();

      rerender(
        <TooltipProvider>
          <ToolCallArguments toolName="search" args={{ query: 'paris' }} argsText='{"query":"par' />
        </TooltipProvider>,
      );
      expect(screen.getByText(/"query": "paris"/)).toBeTruthy();
      expect(screen.queryByText('{"query":"par')).toBeNull();
    });
  });
});
