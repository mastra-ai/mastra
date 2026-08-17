// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TooltipProvider } from '../../Tooltip';
import { ToolCall } from './tool-call';

const renderToolCall = (node: ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

afterEach(() => cleanup());

describe('ToolCall', () => {
  describe('when a tool is running', () => {
    it('renders the current Factory row semantics and humanized presentation', () => {
      renderToolCall(<ToolCall toolName="execute_command" input={{ command: 'pnpm test' }} status="running" />);

      const tool = screen.getByRole('group', { name: 'Tool: execute_command' });
      expect(tool.getAttribute('aria-busy')).toBe('true');
      expect(within(tool).getByText('Run')).toBeTruthy();
      expect(within(tool).getByText('pnpm test')).toBeTruthy();
      expect(within(tool).queryByText('execute_command')).toBeNull();
    });
  });

  describe('when a tool reaches a terminal state', () => {
    it('marks failure and leaves success visually quiet', () => {
      const { rerender } = renderToolCall(<ToolCall toolName="write_file" input={{}} status="error" />);

      expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();

      rerender(
        <TooltipProvider>
          <ToolCall toolName="write_file" input={{}} status="success" />
        </TooltipProvider>,
      );

      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByRole('group', { name: 'Tool: write_file' }).getAttribute('aria-busy')).toBe('false');
    });
  });

  describe('when the disclosure opens', () => {
    it('shows a terminal command and strips ANSI from its result', () => {
      renderToolCall(
        <ToolCall
          toolName="execute_command"
          input={{ command: 'pnpm test' }}
          result={'\u001b[32mPassed\u001b[0m'}
          status="success"
        />,
      );

      const tool = screen.getByRole('group', { name: 'Tool: execute_command' });
      fireEvent.click(within(tool).getByRole('button'));

      expect(within(tool).getByText('$')).toBeTruthy();
      expect(within(tool).getAllByText('pnpm test')).toHaveLength(2);
      expect(within(tool).getByText('Passed')).toBeTruthy();
      expect(tool.textContent).not.toContain('\u001b');
    });

    it('shows the current bounded edit diff', () => {
      renderToolCall(
        <ToolCall
          toolName="string_replace"
          input={{ path: 'src/a.ts', old_string: 'const a = 1;', new_string: 'const a = 2;' }}
          status="success"
        />,
      );

      fireEvent.click(screen.getByRole('button'));

      const diff = screen.getByRole('group', { name: 'File change' });
      expect(diff.textContent).toContain('const a = 1;');
      expect(diff.textContent).toContain('const a = 2;');
    });

    it('shows a write as a named source-code block', () => {
      renderToolCall(
        <ToolCall
          toolName="write_file"
          input={{ path: 'src/a.ts', content: 'export const answer = 42;' }}
          status="success"
        />,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getAllByText('src/a.ts')).toHaveLength(2);
      expect(screen.getByText('export const answer = 42;')).toBeTruthy();
    });

    it('renders falsy and circular generic values without throwing', () => {
      const circular: Record<string, unknown> = { enabled: false, count: 0, empty: '' };
      circular.self = circular;

      renderToolCall(<ToolCall toolName="custom_tool" input={circular} result={null} status="success" />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('[object Object]')).toBeTruthy();
      expect(screen.getByText('null')).toBeTruthy();
    });
  });

  describe('when an application extends the generic tool', () => {
    it('keeps pending body actions open and header actions outside the disclosure trigger', () => {
      renderToolCall(
        <ToolCall
          toolName="charge_card"
          input={{ amount: 10 }}
          status="running"
          defaultOpen
          headerActions={<button type="button">Routing details</button>}
        >
          <button type="button">Approve</button>
        </ToolCall>,
      );

      const tool = screen.getByRole('group', { name: 'Tool: charge_card' });
      const routingDetails = within(tool).getByRole('button', { name: 'Routing details' });
      expect(routingDetails).toBeTruthy();
      expect(within(tool).getByRole('button', { name: 'Approve' })).toBeTruthy();
      expect(routingDetails.parentElement?.closest('button')).toBeNull();
    });
  });
});
