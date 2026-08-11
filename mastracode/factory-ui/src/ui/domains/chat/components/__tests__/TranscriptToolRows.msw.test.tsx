import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import type { TimelineEntry, ToolCall } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function assistantMessage(
  id: string,
  parts: MastraDBMessage['content']['parts'],
  runtimeTools?: Record<string, ToolCall>,
): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: { id, role: 'assistant', createdAt: CREATED_AT, content: { format: 2, parts } },
    runtimeTools,
  };
}

function userMessage(id: string, text: string): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: { id, role: 'user', createdAt: CREATED_AT, content: { format: 2, parts: [{ type: 'text', text }] } },
  };
}

// Core writes `isError` onto persisted result invocations (session-run-engine)
// without it being part of the declared invocation type.
type ToolInvocationFixture = Extract<MastraMessagePart, { type: 'tool-invocation' }>['toolInvocation'] & {
  isError?: boolean;
};

function doneTool(toolCallId: string, toolName: string): MastraDBMessage['content']['parts'][number] {
  return {
    type: 'tool-invocation',
    toolInvocation: { state: 'result', toolCallId, toolName, args: { path: 'src/index.ts' }, result: 'ok' },
  };
}

function runningTool(toolCallId: string, toolName: string, args: unknown): MastraDBMessage['content']['parts'][number] {
  return { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName, args } };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

describe('TranscriptEntries tool rows', () => {
  it('shows no status icon on success — only running and failed carry indicators', () => {
    renderEntries([
      assistantMessage('msg-1', [doneTool('call-1', 'view')]),
      assistantMessage('msg-2', [runningTool('call-2', 'execute_command', {})]),
      assistantMessage('msg-3', [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'output-error',
            toolCallId: 'call-3',
            toolName: 'write_file',
            args: {},
            errorText: 'boom',
          },
        },
      ]),
    ]);

    // Success is the quiet default: no check mark / "Done" indicator anywhere.
    expect(screen.queryByLabelText('Done')).not.toBeInTheDocument();
    const doneRow = screen.getByRole('group', { name: 'Tool: view' });
    expect(within(doneRow).queryByRole('img')).not.toBeInTheDocument();

    // Running keeps its spinner.
    const runningRow = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(within(runningRow).getByLabelText('Running')).toBeInTheDocument();

    // Failure keeps its red cross.
    const failedRow = screen.getByRole('group', { name: 'Tool: write_file' });
    expect(within(failedRow).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
  });

  it('renders a humanized action and salient argument instead of the raw tool name', () => {
    renderEntries([
      assistantMessage('msg-1', [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'execute_command',
            args: { command: 'pnpm build' },
            result: 'ok',
          },
        },
      ]),
    ]);

    const row = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(within(row).getByText('Run')).toBeInTheDocument();
    expect(within(row).getByText('pnpm build')).toBeInTheDocument();
    expect(within(row).queryByText('execute_command')).not.toBeInTheDocument();
  });

  it('collapses three or more consecutive tool calls into a single group row', async () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'search_content'),
        doneTool('call-3', 'view'),
      ]),
    ]);

    const group = screen.getByRole('group', { name: 'Tool group: 3 steps' });
    expect(screen.queryByRole('group', { name: 'Tool: view' })).not.toBeInTheDocument();

    await userEvent.click(within(group).getAllByRole('button')[0]);
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(2);
  });

  it('surfaces the running action live on a collapsed group header', () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        doneTool('call-3', 'view'),
        runningTool('call-4', 'execute_command', { command: 'pnpm test' }),
      ]),
    ]);

    const group = screen.getByRole('group', { name: 'Tool group: 4 steps' });
    expect(within(group).getByText('Run')).toBeInTheDocument();
    expect(within(group).getByText('pnpm test')).toBeInTheDocument();
    expect(within(group).getByText('3/4')).toBeInTheDocument();
    expect(within(group).getByLabelText('Running')).toBeInTheDocument();
  });

  it('does not group runs broken by prose', () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        { type: 'text', text: 'Interlude' },
        doneTool('call-3', 'view'),
      ]),
    ]);

    expect(screen.queryByRole('group', { name: /Tool group/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
  });

  it('trusts the persisted result over a stale running overlay — a lost tool_end must not spin forever', () => {
    renderEntries([
      assistantMessage('msg-1', [doneTool('call-1', 'view')], {
        'call-1': { toolCallId: 'call-1', toolName: 'view', argsText: '', status: 'running', output: '' },
      }),
    ]);

    expect(screen.queryByLabelText('Running')).not.toBeInTheDocument();
    const row = screen.getByRole('group', { name: 'Tool: view' });
    expect(within(row).queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a persisted errored result as failed even under a stale running overlay', () => {
    const toolInvocation: ToolInvocationFixture = {
      state: 'result',
      toolCallId: 'call-1',
      toolName: 'write_file',
      args: {},
      result: 'boom',
      isError: true,
    };
    renderEntries([
      assistantMessage('msg-1', [{ type: 'tool-invocation', toolInvocation }], {
        'call-1': { toolCallId: 'call-1', toolName: 'write_file', argsText: '', status: 'running', output: '' },
      }),
    ]);

    const row = screen.getByRole('group', { name: 'Tool: write_file' });
    expect(within(row).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
    expect(within(row).queryByLabelText('Running')).not.toBeInTheDocument();
  });

  it.each(['output-error', 'output-denied'] as const)(
    'renders a persisted %s part as failed even under a stale running overlay',
    state => {
      renderEntries([
        assistantMessage(
          'msg-1',
          [
            {
              type: 'tool-invocation',
              toolInvocation: { state, toolCallId: 'call-1', toolName: 'write_file', args: {}, errorText: 'nope' },
            },
          ],
          {
            'call-1': { toolCallId: 'call-1', toolName: 'write_file', argsText: '', status: 'running', output: '' },
          },
        ),
      ]);

      const row = screen.getByRole('group', { name: 'Tool: write_file' });
      expect(within(row).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
      expect(within(row).queryByLabelText('Running')).not.toBeInTheDocument();
    },
  );

  it('gives prose entries their own vertical margins so rows stay on a uniform rhythm', () => {
    renderEntries([
      userMessage('msg-user', 'Please run the tests'),
      assistantMessage('msg-tools', [doneTool('call-1', 'execute_command')]),
      assistantMessage('msg-text', [{ type: 'text', text: 'All 36 tests passed.' }]),
    ]);

    // The transcript container no longer adds gaps between entries, so prose
    // content must own its breathing room via explicit margins.
    const userBubbleWrapper = screen.getByText('Please run the tests').closest('.items-end');
    expect(userBubbleWrapper).toHaveClass('my-3');

    const assistantProse = screen.getByText('All 36 tests passed.').closest('.prose');
    expect(assistantProse).toHaveClass('my-3');
  });
});
