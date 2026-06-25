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
  it('renders tool arguments as a static code block', () => {
    renderWithProviders(
      <ToolBadge
        toolName="searchDocs"
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
      />,
    );

    fireEvent.click(screen.getByText('searchDocs'));

    const toolArgs = screen.getByTestId('tool-args');

    expect(toolArgs.textContent).toContain('"query": "CodeBlock"');
    expect(toolArgs.textContent).not.toContain('__mastraMetadata');
    expect(toolArgs.textContent).not.toContain('_background');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });

  it('renders tool results as a static code block', () => {
    renderWithProviders(
      <ToolBadge
        toolName="getWeather"
        args={{ location: 'Paris' }}
        result={{
          temperature: 20,
          conditions: 'cloudy',
        }}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
      />,
    );

    fireEvent.click(screen.getByText('getWeather'));

    const toolResult = screen.getByTestId('tool-result');

    expect(toolResult.textContent).toContain('"temperature": 20');
    expect(toolResult.textContent).toContain('"conditions": "cloudy"');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });
});
