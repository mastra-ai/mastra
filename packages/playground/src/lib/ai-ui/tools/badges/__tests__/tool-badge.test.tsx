import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolBadge } from '../tool-badge';
import { ToolCallProvider } from '@/services/tool-call-provider';

const renderWithProviders = (node: ReactNode) =>
  render(
    <TooltipProvider>
      <ToolCallProvider
        approveToolcall={vi.fn()}
        declineToolcall={vi.fn()}
        approveToolcallGenerate={vi.fn()}
        declineToolcallGenerate={vi.fn()}
        approveNetworkToolcall={vi.fn()}
        declineNetworkToolcall={vi.fn()}
        isRunning={false}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        {node}
      </ToolCallProvider>
    </TooltipProvider>,
  );

afterEach(() => cleanup());

describe('ToolBadge', () => {
  it('uses the Factory tool row and filters internal arguments', () => {
    renderWithProviders(
      <ToolBadge
        toolName="search_docs"
        args={{
          query: 'CodeBlock',
          __mastraMetadata: { source: 'internal' },
          _background: true,
        }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
        state="input-available"
      />,
    );

    const tool = screen.getByRole('group', { name: 'Tool: search_docs' });
    expect(tool.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Search docs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Search docs/ }));

    expect(tool.textContent).toContain('"query": "CodeBlock"');
    expect(tool.textContent).not.toContain('__mastraMetadata');
    expect(tool.textContent).not.toContain('_background');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });

  it('renders successful results inside the shared disclosure', () => {
    renderWithProviders(
      <ToolBadge
        toolName="get_weather"
        args={{ location: 'Paris' }}
        result={{
          temperature: 20,
          conditions: 'cloudy',
        }}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
        state="output-available"
      />,
    );

    const tool = screen.getByRole('group', { name: 'Tool: get_weather' });
    expect(tool.getAttribute('aria-busy')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Get weather/ }));

    expect(tool.textContent).toContain('"temperature": 20');
    expect(tool.textContent).toContain('"conditions": "cloudy"');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });

  it('maps failed calls to the Factory failure state', () => {
    renderWithProviders(
      <ToolBadge
        toolName="fetch_weather"
        args={{ location: 'Paris' }}
        result="Request failed"
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
        state="output-error"
      />,
    );

    expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
  });

  it('keeps pending approvals collapsed until requested', () => {
    renderWithProviders(
      <ToolBadge
        toolName="charge_card"
        args={{ amount: 42 }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'charge_card', args: { amount: 42 } }}
        isNetwork={false}
        state="input-available"
      />,
    );

    const tool = screen.getByRole('group', { name: 'Tool: charge_card' });
    const trigger = screen.getByRole('button', { name: /Charge card/ });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(tool.textContent).not.toContain('Approval is required to continue.');

    fireEvent.click(trigger);

    expect(tool.textContent).toContain('Approval is required to continue.');
    expect(screen.getByRole('button', { name: /Approve/ })).toBeTruthy();
  });
});
