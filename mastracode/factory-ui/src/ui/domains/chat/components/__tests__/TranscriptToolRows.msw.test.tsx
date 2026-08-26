import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../e2e/ui/render';
import { initialTranscript, transcriptReducer } from '../../services/transcript';
import type { TimelineEntry, ToolCall } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function assistantMessage(
  id: string,
  parts: MastraDBMessage['content']['parts'],
  runtimeTools?: Record<string, ToolCall>,
  streaming?: boolean,
): TimelineEntry {
  return {
    kind: 'message',
    id,
    message: { id, role: 'assistant', createdAt: CREATED_AT, content: { format: 2, parts } },
    runtimeTools,
    streaming,
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
  // The plan card resolves its workspace from the route, so entries render under a router like in the app.
  return renderWithProviders(
    <MemoryRouter>
      <TranscriptEntries entries={entries} onApprove={() => {}} onRespond={() => {}} />
    </MemoryRouter>,
  );
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

  it('leaves a run the reader watched expanded, even once the reply is done', () => {
    const watched = [doneTool('call-1', 'view'), doneTool('call-2', 'search_content'), doneTool('call-3', 'view')];
    const { rerender } = renderEntries([assistantMessage('msg-1', watched, undefined, true)]);

    rerender(
      <MemoryRouter>
        <TranscriptEntries
          entries={[assistantMessage('msg-1', watched, undefined, false)]}
          onApprove={() => {}}
          onRespond={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('group', { name: 'Tool group: 3 steps' })).not.toBeInTheDocument();
  });

  it('leaves the tool rows of a still-arriving reply alone rather than swallowing what is being read', async () => {
    renderEntries([
      assistantMessage(
        'msg-1',
        [doneTool('call-1', 'view'), doneTool('call-2', 'search_content'), doneTool('call-3', 'view')],
        undefined,
        true,
      ),
    ]);

    await waitFor(() => expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(2), {
      timeout: 5000,
    });
    expect(screen.queryByRole('group', { name: 'Tool group: 3 steps' })).not.toBeInTheDocument();
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
    expect(within(group).getByText('4 steps')).toBeInTheDocument();
    expect(within(group).getByText('pnpm test')).toBeInTheDocument();
    expect(within(group).getByRole('img', { name: 'Read, Run' })).toBeInTheDocument();
    expect(within(group).getByText('3/4')).toBeInTheDocument();
    expect(group).toHaveAttribute('aria-busy', 'true');
  });

  it('keeps a call landing under the reader as its own row, even on an entry restored mid-run', async () => {
    const restored = [doneTool('call-1', 'view'), doneTool('call-2', 'view')];
    const { rerender } = renderEntries([assistantMessage('msg-1', restored)]);

    rerender(
      <MemoryRouter>
        <TranscriptEntries
          entries={[assistantMessage('msg-1', [...restored, doneTool('call-3', 'view')])]}
          onApprove={() => {}}
          onRespond={() => {}}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3), {
      timeout: 5000,
    });
    expect(screen.queryByRole('group', { name: /Tool group/ })).not.toBeInTheDocument();
  });

  it('keeps the words on screen in place when an ask_user prompt fills its slot above them', () => {
    const askUser = runningTool('call-ask', 'ask_user', { question: 'Which auth flow?' });
    const parts = [
      { type: 'text' as const, text: 'Two flows exist.\n\n' },
      askUser,
      { type: 'text' as const, text: 'Both are supported.' },
    ];
    const { rerender } = renderEntries([assistantMessage('msg-1', parts)]);
    const settledText = screen.getByText('Both are supported.');

    rerender(
      <MemoryRouter>
        <TranscriptEntries
          entries={[
            assistantMessage('msg-1', parts),
            {
              kind: 'suspension',
              id: 'suspension-call-ask',
              toolCallId: 'call-ask',
              toolName: 'ask_user',
              args: {},
              suspendPayload: { question: 'Which auth flow?' },
            },
          ]}
          onApprove={() => {}}
          onRespond={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('group', { name: 'Question from the agent' })).toBeInTheDocument();
    expect(screen.getByText('Both are supported.')).toBe(settledText);
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
    ['skill', 'Skill: understand-issue', { name: 'understand-issue' }],
  ])('breaks a run on %s so its card is never swallowed by a group', (toolName, promptLabel, args) => {
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

  it('reconstructs a resolved submit_plan card from persisted message history after reload', () => {
    const persistedMessage: MastraDBMessage = {
      id: 'msg-plan-resolved',
      role: 'assistant',
      createdAt: CREATED_AT,
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'plan-call-1',
              toolName: 'submit_plan',
              args: { path: '.artifacts/plans/reloaded.md' },
              result: {
                toolId: 'submit_plan',
                content: 'Plan rejected with feedback.',
                submittedPlan: {
                  title: 'Reloaded plan',
                  path: '.artifacts/plans/reloaded.md',
                  plan: '## Durable step\n\nUse the persisted result.',
                  feedback: 'Add a rollback step.',
                },
              },
            },
          },
        ],
      },
    };
    const restored = transcriptReducer(initialTranscript, { type: 'mergeWindow', messages: [persistedMessage] });

    renderEntries(restored.entries);

    const card = screen.getByRole('group', { name: 'Plan approval' });
    expect(within(card).getByText('Reloaded plan')).toBeInTheDocument();
    expect(within(card).getByText('Use the persisted result.')).toBeInTheDocument();
    expect(within(card).getByRole('note', { name: 'Plan feedback' })).toHaveTextContent('Add a rollback step.');
    expect(within(card).queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
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

  it('breaks the run at a waiting ask_user so nothing regroups when its prompt lands', () => {
    const message = assistantMessage('msg-1', [
      doneTool('call-1', 'view'),
      doneTool('call-2', 'view'),
      doneTool('call-3', 'view'),
      runningTool('call-4', 'ask_user', {}),
      doneTool('call-5', 'view'),
    ]);
    const { rerender } = renderEntries([message]);

    expect(screen.getByRole('group', { name: 'Tool group: 3 steps' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Question from the agent' })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <TranscriptEntries
          entries={[
            message,
            {
              kind: 'suspension',
              id: 'susp-1',
              toolCallId: 'call-4',
              toolName: 'ask_user',
              args: {},
              suspendPayload: { question: 'Which file should I edit?' },
            },
          ]}
          onApprove={() => {}}
          onRespond={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('group', { name: 'Tool group: 3 steps' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Question from the agent' })).toBeInTheDocument();
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

    const assistantProse = screen.getByText('All 36 tests passed.').closest('.mastra-markdown');
    expect(assistantProse).toHaveClass('my-3');
  });
});
