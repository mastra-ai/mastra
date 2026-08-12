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

function doneTool(
  toolCallId: string,
  toolName: string,
  args: unknown = { path: 'src/index.ts' },
): MastraDBMessage['content']['parts'][number] {
  return { type: 'tool-invocation', toolInvocation: { state: 'result', toolCallId, toolName, args, result: 'ok' } };
}

function runningTool(toolCallId: string, toolName: string, args: unknown): MastraDBMessage['content']['parts'][number] {
  return { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId, toolName, args } };
}

function renderEntries(entries: TimelineEntry[]) {
  return renderWithProviders(<TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />);
}

describe('TranscriptEntries tool rows', () => {
  it('marks a running call busy instead of spinning, and leaves success unmarked', () => {
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
    expect(doneRow).toHaveAttribute('aria-busy', 'false');

    // Running carries no icon at all — the shimmering label is the cue.
    const runningRow = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(runningRow).toHaveAttribute('aria-busy', 'true');
    expect(within(runningRow).queryByRole('img')).not.toBeInTheDocument();

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
    expect(group).toHaveAttribute('aria-busy', 'true');
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

  it.each([
    ['ask_user', 'Question from the agent', { question: 'Which file should I edit?' }],
    ['submit_plan', 'Plan approval', { plan: { title: 'Ship the fix', content: 'Step one' } }],
  ])('breaks a run on %s so its prompt is never swallowed by a group', (toolName, promptLabel, args) => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        doneTool('call-3', toolName, args),
        doneTool('call-4', 'view'),
        doneTool('call-5', 'view'),
      ]),
    ]);

    expect(screen.queryByRole('group', { name: /Tool group/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: promptLabel })).toBeInTheDocument();
  });

  it('breaks a run on a suspended call so the agent question stays answerable', () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        runningTool('call-3', 'ask_user', {}),
        doneTool('call-4', 'view'),
        doneTool('call-5', 'view'),
      ]),
      {
        kind: 'suspension',
        id: 'susp-1',
        toolCallId: 'call-3',
        toolName: 'ask_user',
        args: {},
        suspendPayload: { question: 'Which file should I edit?' },
      },
    ]);

    expect(screen.queryByRole('group', { name: /Tool group/ })).not.toBeInTheDocument();
    const question = screen.getByRole('group', { name: 'Question from the agent' });
    expect(within(question).getByText('Which file should I edit?')).toBeInTheDocument();
  });

  it('trusts the persisted result over a stale running overlay — a lost tool_end must not spin forever', () => {
    renderEntries([
      assistantMessage('msg-1', [doneTool('call-1', 'view')], {
        'call-1': { toolCallId: 'call-1', toolName: 'view', argsText: '', status: 'running', output: '' },
      }),
    ]);

    const row = screen.getByRole('group', { name: 'Tool: view' });
    expect(row).toHaveAttribute('aria-busy', 'false');
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
    expect(row).toHaveAttribute('aria-busy', 'false');
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
      expect(row).toHaveAttribute('aria-busy', 'false');
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
