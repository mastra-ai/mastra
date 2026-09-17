// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolBadge } from '../tool-badge';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { TooltipProvider } from '@/ds/components/Tooltip';

const renderWithProviders = (node: ReactNode, { isContinuationBlocked }: { isContinuationBlocked?: boolean } = {}) =>
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
        isContinuationBlocked={isContinuationBlocked}
        toolCallApprovals={{}}
        networkToolCallApprovals={{}}
      >
        {node}
      </ToolCallProvider>
    </TooltipProvider>,
  );

afterEach(() => cleanup());

describe('ToolBadge', () => {
  it('offers nothing to open for a call whose only arguments are internal metadata', () => {
    renderWithProviders(
      <ToolBadge
        toolName="listAgents"
        args={{ __mastraMetadata: { source: 'internal' } }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
      />,
    );

    expect(screen.getByText('ListAgents')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

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

    fireEvent.click(screen.getByRole('button', { name: /SearchDocs/ }));

    const toolArgs = screen.getByTestId('tool-args');

    expect(toolArgs.textContent).toContain('"query": "CodeBlock"');
    expect(toolArgs.textContent).not.toContain('__mastraMetadata');
    expect(toolArgs.textContent).not.toContain('_background');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });

  it("shows a command's description alone on its row, and the command without one", () => {
    const command = "cd packages/core && rg -n 'processor' src | head -20";
    const badge = (args: Record<string, unknown>) => (
      <ToolBadge
        toolName="execute_command"
        args={args}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
      />
    );

    const { unmount } = renderWithProviders(badge({ description: 'Finding the processor wiring', command }));
    expect(screen.getByText('Finding the processor wiring')).toBeTruthy();
    expect(screen.queryByText('Run')).toBeNull();
    unmount();

    renderWithProviders(badge({ command }));
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText("rg -n 'processor' src | head -20")).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: /GetWeather/ }));

    const toolResult = screen.getByTestId('tool-result');

    expect(toolResult.textContent).toContain('"temperature": 20');
    expect(toolResult.textContent).toContain('"conditions": "cloudy"');
    expect(screen.queryByLabelText('Code editor')).toBeNull();
  });

  it('disables approval actions when the run continuation is fatally blocked', () => {
    renderWithProviders(
      <ToolBadge
        toolName="getWeather"
        args={{ location: 'Paris' }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'getWeather', args: { location: 'Paris' } }}
        isNetwork={false}
      />,
      { isContinuationBlocked: true },
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve getWeather' }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Decline getWeather' }).disabled).toBe(true);
  });

  it('keeps approval actions enabled by default', () => {
    renderWithProviders(
      <ToolBadge
        toolName="getWeather"
        args={{ location: 'Paris' }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={{ toolCallId: 'call-1', toolName: 'getWeather', args: { location: 'Paris' } }}
        isNetwork={false}
      />,
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Approve getWeather' }).disabled).toBe(false);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Decline getWeather' }).disabled).toBe(false);
  });

  it('renders a result of false, since a falsy value is still an answer', () => {
    renderWithProviders(
      <ToolBadge
        toolName="checkAccess"
        args={{ user: 'ada' }}
        result={false}
        toolOutput={[]}
        toolCallId="call-1"
        toolApprovalMetadata={undefined}
        isNetwork={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /CheckAccess/ }));

    expect(screen.getByTestId('tool-result').textContent).toBe('false');
  });
});

describe('ToolBadge edit body', () => {
  describe('when a successful edit returns a long result', () => {
    it('keeps the full result copyable alongside the file change', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const result = 'Updated successfully.\n'.repeat(100);
      renderWithProviders(
        <ToolBadge
          toolName="mastra_workspace_edit_file"
          args={{ path: 'a.ts', old_string: 'x', new_string: 'y' }}
          result={result}
          toolOutput={[]}
          toolCallId="call-edit"
          toolApprovalMetadata={undefined}
          isNetwork={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Edit/ }));

      expect(screen.getByRole('group', { name: 'File change' })).toBeTruthy();
      expect(screen.getByTestId('tool-result').textContent).toBe(result);
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
      await screen.findByRole('button', { name: 'Copied!' });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(result);
    });
  });

  describe('when a shell command includes additional arguments', () => {
    it('keeps every argument available for inspection and copying', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const args = { command: 'pnpm test', cwd: '/workspace', timeout: 30000 };
      renderWithProviders(
        <ToolBadge
          toolName="execute_command"
          args={args}
          result={undefined}
          toolOutput={[]}
          toolCallId="call-command"
          toolApprovalMetadata={undefined}
          isNetwork={false}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Run/ }));

      expect(screen.getByTestId('tool-args').textContent).toContain('"cwd": "/workspace"');
      expect(screen.getByTestId('tool-args').textContent).toContain('"timeout": 30000');
      fireEvent.click(screen.getByRole('button', { name: 'Copy to clipboard' }));
      await screen.findByRole('button', { name: 'Copied!' });
      expect(writeText).toHaveBeenCalledExactlyOnceWith(JSON.stringify(args, null, 2));
    });
  });

  it('shows an edit-style call as a diff instead of raw arguments', () => {
    renderWithProviders(
      <ToolBadge
        toolName="mastra_workspace_edit_file"
        args={{ path: 'a.ts', old_string: 'x', new_string: 'y' }}
        result={undefined}
        toolOutput={[]}
        toolCallId="call-3"
        toolApprovalMetadata={undefined}
        isNetwork={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));

    expect(screen.getByRole('group', { name: 'File change' })).toBeTruthy();
    expect(screen.queryByTestId('tool-args')).toBeNull();
  });
});
