// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode, SVGProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { ToolCoinIcon } from '../../../icons/ToolCoinIcon';
import { TooltipProvider } from '../../Tooltip';
import { Tool, ToolCall, ToolCallListItem, ToolContent, ToolHeader, ToolIcon } from './tool-call';

const renderToolCall = (node: ReactNode) => render(<TooltipProvider>{node}</TooltipProvider>);

afterEach(() => cleanup());

describe('Tool', () => {
  describe('when an application composes a custom tool', () => {
    it('lets the header disclose arbitrary application content', () => {
      const WorkflowIcon = (props: SVGProps<SVGSVGElement>) => <svg data-testid="workflow-icon" {...props} />;

      renderToolCall(
        <Tool status="success" aria-label="Order fulfillment workflow">
          <ToolHeader>
            <ToolIcon>
              <WorkflowIcon className="text-accent3" />
            </ToolIcon>
            Order fulfillment
          </ToolHeader>
          <ToolContent>
            <div>Workflow graph</div>
          </ToolContent>
        </Tool>,
      );

      const tool = screen.getByRole('group', { name: 'Order fulfillment workflow' });
      expect(within(tool).getByText('Order fulfillment')).toBeTruthy();
      expect(within(tool).getByTestId('workflow-icon').classList.contains('text-accent3')).toBe(true);
      expect(within(tool).queryByText('Workflow graph')).toBeNull();

      fireEvent.click(within(tool).getByRole('button', { name: /Order fulfillment/ }));

      expect(within(tool).getByText('Workflow graph')).toBeTruthy();
    });

    it('keeps header actions outside the disclosure button', () => {
      renderToolCall(
        <Tool status="running" defaultOpen aria-label="Network workflow">
          <ToolHeader actions={<button type="button">Routing details</button>}>
            <ToolIcon>
              <svg aria-hidden />
            </ToolIcon>
            Network workflow
          </ToolHeader>
          <ToolContent>
            <button type="button">Approve</button>
          </ToolContent>
        </Tool>,
      );

      const tool = screen.getByRole('group', { name: 'Network workflow' });
      const details = within(tool).getByRole('button', { name: 'Routing details' });
      expect(details.parentElement?.closest('button')).toBeNull();
      expect(within(tool).getByRole('button', { name: 'Approve' })).toBeTruthy();
    });

    it('keeps the entity icon color while showing a separate failure marker', () => {
      const AgentIcon = (props: SVGProps<SVGSVGElement>) => <svg data-testid="agent-icon" {...props} />;

      renderToolCall(
        <Tool status="error" aria-label="Weather agent">
          <ToolHeader>
            <ToolIcon>
              <AgentIcon className="text-accent1" />
            </ToolIcon>
            Weather agent
          </ToolHeader>
          <ToolContent>Agent output</ToolContent>
        </Tool>,
      );

      expect(screen.getByTestId('agent-icon').classList.contains('text-accent1')).toBe(true);
      expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
    });

    it('renders a non-collapsible header without a disclosure button', () => {
      renderToolCall(
        <Tool status="running" collapsible={false} aria-label="Loading agent">
          <ToolHeader>
            <ToolIcon>
              <svg aria-hidden />
            </ToolIcon>
            Loading agent
          </ToolHeader>
        </Tool>,
      );

      const tool = screen.getByRole('group', { name: 'Loading agent' });
      expect(within(tool).getByText('Loading agent')).toBeTruthy();
      expect(within(tool).queryByRole('button')).toBeNull();
    });

    it('does not add a grouping rail to custom content', () => {
      renderToolCall(
        <Tool status="running" defaultOpen aria-label="Confirm order">
          <ToolHeader>
            <ToolIcon>
              <svg aria-hidden />
            </ToolIcon>
            Confirm order
          </ToolHeader>
          <ToolContent>
            <button type="button">Approve</button>
          </ToolContent>
        </Tool>,
      );

      const tool = screen.getByRole('group', { name: 'Confirm order' });
      expect(within(tool).getByRole('button', { name: 'Approve' })).toBeTruthy();
      expect(tool.querySelector('[data-tool-call-rail]')).toBeNull();
    });

    it('can preserve an existing custom tool disclosure state', () => {
      const ExistingCustomTool = () => {
        const [isCollapsed, setIsCollapsed] = useState(true);
        return (
          <Tool
            status="success"
            open={!isCollapsed}
            onOpenChange={open => setIsCollapsed(!open)}
            aria-label="Existing custom tool"
          >
            <ToolHeader>{isCollapsed ? 'Collapsed summary' : 'Expanded tool'}</ToolHeader>
            <ToolContent>Original custom body</ToolContent>
          </Tool>
        );
      };

      renderToolCall(<ExistingCustomTool />);

      expect(screen.getByText('Collapsed summary')).toBeTruthy();
      expect(screen.queryByText('Original custom body')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Collapsed summary' }));
      expect(screen.getByText('Expanded tool')).toBeTruthy();
      expect(screen.getByText('Original custom body')).toBeTruthy();
    });

    it('keeps multitone custom icons colorable through currentColor', () => {
      const { container } = render(<ToolCoinIcon className="text-accent6" />);

      const paintedPaths = Array.from(container.querySelectorAll('path')).filter(
        path => path.hasAttribute('fill') || path.hasAttribute('stroke'),
      );
      expect(paintedPaths.length).toBeGreaterThan(0);
      expect(
        paintedPaths.every(
          path =>
            (!path.hasAttribute('fill') || path.getAttribute('fill') === 'currentColor') &&
            (!path.hasAttribute('stroke') || path.getAttribute('stroke') === 'currentColor'),
        ),
      ).toBe(true);
    });
  });
});

describe('ToolCallListItem', () => {
  describe('when another tool follows the current item', () => {
    it('renders a visual rail behind the item content', () => {
      renderToolCall(
        <ToolCallListItem continued>
          <Tool status="success" aria-label="First tool">
            <ToolHeader>First tool</ToolHeader>
            <ToolContent>First result</ToolContent>
          </Tool>
        </ToolCallListItem>,
      );

      const rail = document.querySelector('[data-tool-call-rail]');
      const content = document.querySelector('[data-tool-call-list-item-content]');
      const item = content?.parentElement;

      expect(rail).not.toBeNull();
      expect(content?.contains(screen.getByRole('group', { name: 'First tool' }))).toBe(true);
      expect(item?.classList.contains('-mx-1.5')).toBe(true);
      expect(rail?.classList.contains('top-6')).toBe(true);
    });
  });

  describe('when the item ends the sequence', () => {
    it('does not render a trailing rail', () => {
      renderToolCall(
        <ToolCallListItem>
          <Tool status="success" aria-label="Only tool">
            <ToolHeader>Only tool</ToolHeader>
            <ToolContent>Only result</ToolContent>
          </Tool>
        </ToolCallListItem>,
      );

      expect(document.querySelector('[data-tool-call-rail]')).toBeNull();
    });
  });
});

describe('ToolCall', () => {
  describe('when a tool has a generic presentation', () => {
    it('colors operation-specific tool icons yellow by default', () => {
      renderToolCall(<ToolCall toolName="execute_command" input={{ command: 'pnpm test' }} status="success" />);

      const tool = screen.getByRole('group', { name: 'Tool: execute_command' });
      expect(within(tool).getByText('Run')).toBeTruthy();
      expect(tool.querySelector('svg')?.classList.contains('text-accent6')).toBe(true);
    });
  });

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
    it('groups valid JSON input and output into labeled highlighted sections', async () => {
      renderToolCall(
        <ToolCall
          toolName="weatherInfo"
          input={'{"city":"Paris"}'}
          result={'{"temperature":18}'}
          status="success"
          defaultOpen
        />,
      );

      const tool = screen.getByRole('group', { name: 'Tool: weatherInfo' });
      const dataCard = within(tool).getByRole('group', { name: 'Tool input and output' });
      const input = within(dataCard).getByRole('group', { name: 'Input' });
      const output = within(dataCard).getByRole('group', { name: 'Output' });

      expect(input.textContent).toContain('"city": "Paris"');
      expect(output.textContent).toContain('"temperature": 18');
      await waitFor(() => {
        expect(input.querySelector('.shiki-token')).not.toBeNull();
        expect(output.querySelector('.shiki-token')).not.toBeNull();
      });
    });

    it('falls back to labeled plain text when input and output are not JSON', () => {
      renderToolCall(
        <ToolCall toolName="weatherInfo" input="city=Paris" result="sunny" status="success" defaultOpen />,
      );

      const dataCard = screen.getByRole('group', { name: 'Tool input and output' });
      const input = within(dataCard).getByRole('group', { name: 'Input' });
      const output = within(dataCard).getByRole('group', { name: 'Output' });

      expect(within(input).getByText('city=Paris')).toBeTruthy();
      expect(within(output).getByText('sunny')).toBeTruthy();
      expect(dataCard.querySelector('.shiki-token')).toBeNull();
    });

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
