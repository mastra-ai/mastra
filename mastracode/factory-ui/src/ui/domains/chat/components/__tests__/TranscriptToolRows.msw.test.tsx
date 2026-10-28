import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent-controller';
import { formatDate } from '@mastra/playground-ui/utils/date-format';
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

function entriesView(entries: TimelineEntry[], running = false) {
  // The plan card resolves its workspace from the route, so entries render under a router like in the app.
  return (
    <MemoryRouter>
      <TranscriptEntries entries={entries} running={running} onApprove={() => {}} onRespond={() => {}} />
    </MemoryRouter>
  );
}

function renderEntries(entries: TimelineEntry[], running = false) {
  return renderWithProviders(entriesView(entries, running));
}

function stretchLines(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="activity-stretch"]'));
}

async function expand(line: HTMLElement) {
  await userEvent.click(within(line).getAllByRole('button')[0]);
}

describe('TranscriptEntries tool rows', () => {
  it('folds a reloaded turn, one step per call, into one line that counts what failed or never finished', async () => {
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

    const line = screen.getByRole('group', { name: 'Read a file, ran a command, wrote a file' });
    expect(within(line).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
    expect(within(line).getByText('1 failed · 1 incomplete')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Tool: view' })).not.toBeInTheDocument();

    await expand(line);
    // Success is the quiet default: no check mark / "Done" indicator anywhere.
    expect(screen.queryByLabelText('Done')).not.toBeInTheDocument();
    const doneRow = screen.getByRole('group', { name: 'Tool: view' });
    expect(within(doneRow).queryByRole('img')).not.toBeInTheDocument();
    expect(doneRow).toHaveAttribute('aria-busy', 'false');
    // Running carries no icon at all — the shimmering label is the cue.
    const runningRow = screen.getByRole('group', { name: 'Tool: execute_command' });
    expect(runningRow).toHaveAttribute('aria-busy', 'true');
    expect(within(runningRow).queryByRole('img')).not.toBeInTheDocument();
    const failedRow = screen.getByRole('group', { name: 'Tool: write_file' });
    expect(within(failedRow).getByRole('img', { name: 'Failed' })).toBeInTheDocument();
  });

  it('names a single call in the past tense with its salient argument, not the raw tool name', () => {
    renderEntries([assistantMessage('msg-1', [doneTool('call-1', 'execute_command', { command: 'pnpm build' })])]);

    const line = screen.getByRole('group', { name: 'Ran pnpm build' });
    expect(within(line).getByText('Ran')).toBeInTheDocument();
    expect(within(line).getByText('pnpm build')).toBeInTheDocument();
    expect(within(line).queryByText('execute_command')).not.toBeInTheDocument();
  });

  it("reads a running shell command's description alone, and shows the command when expanded", async () => {
    const command = "cd packages/core && rg -n 'processor' src";
    renderEntries(
      [
        assistantMessage('msg-1', [
          runningTool('call-1', 'execute_command', { description: 'Finding the processor wiring', command }),
        ]),
      ],
      true,
    );

    const line = screen.getByRole('group', { name: 'Finding the processor wiring' });
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(within(line).queryByText(/rg -n/)).not.toBeInTheDocument();

    await expand(line);
    expect(within(line).getByText(/rg -n 'processor' src/)).toBeInTheDocument();
  });

  it('folds consecutive calls into one line that summarizes what they did', async () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'search_content'),
        doneTool('call-3', 'view'),
      ]),
    ]);

    const line = screen.getByRole('group', { name: 'Read files, searched code' });
    expect(screen.queryByRole('group', { name: 'Tool: view' })).not.toBeInTheDocument();

    await expand(line);
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(2);
  });

  it('opens a stretch onto its thoughts as prose, folding the calls made between two thoughts into a group', async () => {
    renderEntries([
      assistantMessage('step-1', [
        { type: 'reasoning', reasoning: 'The board query caps at 50 items.', details: [] },
        doneTool('call-1', 'view', { path: 'a.ts' }),
      ]),
      assistantMessage('step-2', [
        { type: 'reasoning', reasoning: 'Page by week instead.', details: [] },
        doneTool('call-2', 'view', { path: 'b.ts' }),
        doneTool('call-3', 'search_content', { pattern: 'week' }),
      ]),
    ]);

    const line = screen.getByRole('group', { name: 'Read files, searched code' });
    await expand(line);

    const rows = Array.from(line.querySelectorAll<HTMLElement>('[data-activity-key]'), row => row.textContent ?? '');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('The board query caps at 50 items.');
    expect(rows[1]).toContain('a.ts');
    expect(rows[2]).toContain('Page by week instead.');
    expect(rows[3]).not.toContain('b.ts');

    const calls = within(line).getByRole('group', { name: 'Read a file, searched code' });
    await expand(calls);
    expect(within(calls).getByText('b.ts')).toBeInTheDocument();
    expect(within(calls).getByRole('group', { name: 'Tool: search_content' })).toBeInTheDocument();
  });

  it('says how long a settled stretch took, from its first thought to the reply that ended it', () => {
    const startedAt = Date.UTC(2026, 9, 28, 9, 44, 44);
    renderEntries([
      assistantMessage('step-1', [
        { type: 'reasoning', reasoning: 'Check the board.', details: [], createdAt: startedAt },
        doneTool('call-1', 'view', { path: 'a.ts' }),
      ]),
      assistantMessage('step-2', [{ type: 'text', text: 'Here is the summary.', createdAt: startedAt + 72_000 }]),
    ]);

    const line = screen.getByRole('group', { name: 'Read a.ts, 1m 12s' });
    expect(within(line).getByText('· 1m 12s')).toBeVisible();
  });

  it('keeps calls the reader opened in view when a thought joins them and they become a group', async () => {
    const calls = assistantMessage('step-1', [
      doneTool('call-1', 'view', { path: 'a.ts' }),
      doneTool('call-2', 'view', { path: 'b.ts' }),
    ]);
    const { rerender } = renderEntries([calls]);
    await expand(screen.getByRole('group', { name: 'Read files' }));
    expect(screen.getByText('b.ts')).toBeInTheDocument();

    rerender(
      entriesView([calls, assistantMessage('step-2', [{ type: 'reasoning', reasoning: 'Both agree.', details: [] }])]),
    );

    const [line] = stretchLines();
    expect(within(line).getByText('Both agree.')).toBeInTheDocument();
    expect(within(within(line).getByRole('group', { name: 'Read files' })).getByText('b.ts')).toBeInTheDocument();
  });

  it('folds a still-arriving run as it plays, so the reply reads as one busy line', async () => {
    renderEntries(
      [
        assistantMessage(
          'msg-1',
          [
            doneTool('call-1', 'view'),
            doneTool('call-2', 'search_content'),
            runningTool('call-3', 'execute_command', { command: 'pnpm test' }),
          ],
          undefined,
          true,
        ),
      ],
      true,
    );

    const line = await screen.findByRole('group', { name: 'Running pnpm test' }, { timeout: 5000 });
    expect(line).toHaveAttribute('aria-busy', 'true');
    expect(stretchLines()).toEqual([line]);
    expect(screen.queryByRole('group', { name: 'Tool: view' })).not.toBeInTheDocument();
  });

  it('reads what the running call is doing on the collapsed line', () => {
    renderEntries(
      [
        assistantMessage('msg-1', [
          doneTool('call-1', 'view'),
          doneTool('call-2', 'view'),
          doneTool('call-3', 'view'),
          runningTool('call-4', 'execute_command', { command: 'pnpm test' }),
        ]),
      ],
      true,
    );

    const line = screen.getByRole('group', { name: 'Running pnpm test' });
    expect(within(line).getByText('pnpm test')).toBeInTheDocument();
    expect(line).toHaveAttribute('aria-busy', 'true');
  });

  it('keeps one line as further calls land, without remounting it', async () => {
    const restored = [doneTool('call-1', 'view'), doneTool('call-2', 'view')];
    const { rerender } = renderEntries([assistantMessage('msg-1', restored)]);
    const line = screen.getByRole('group', { name: 'Read files' });

    rerender(entriesView([assistantMessage('msg-1', [...restored, doneTool('call-3', 'view')])]));

    expect(screen.getByRole('group', { name: 'Read files' })).toBe(line);
    await expand(line);
    await waitFor(() => expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3), {
      timeout: 3000,
    });
  });

  it('draws a live turn and the same turn reloaded as one step per part identically', () => {
    const parts = [
      doneTool('call-a', 'view', { path: 'a.ts' }),
      doneTool('call-b', 'view', { path: 'b.ts' }),
      { type: 'text' as const, text: 'Done' },
      doneTool('call-c', 'execute_command', { command: 'pnpm lint' }),
    ];
    const drawn = () => ({
      lines: stretchLines().map(line => line.getAttribute('aria-label')),
      text: document.body.textContent,
    });

    const live = renderEntries([assistantMessage('msg-1', parts)]);
    const liveDrawn = drawn();
    live.unmount();
    renderEntries(parts.map((part, index) => assistantMessage(`step-${index}`, [part])));

    expect(liveDrawn.lines).toEqual(['Read files', 'Ran pnpm lint']);
    expect(drawn()).toEqual(liveDrawn);
  });

  it('keeps a line and the rows opened in it open when older history moves it into an earlier step', async () => {
    const stepB = assistantMessage('step-b', [doneTool('call-b', 'view', { path: 'b.ts' })]);
    const stepC = assistantMessage('step-c', [doneTool('call-c', 'view', { path: 'c.ts' })]);
    const { rerender } = renderEntries([stepB, stepC]);
    await expand(screen.getByRole('group', { name: 'Read files' }));
    const rowC = () =>
      screen.getAllByRole('group', { name: 'Tool: view' }).find(row => row.textContent?.includes('c.ts'));
    await userEvent.click(within(rowC()!).getByRole('button'));

    rerender(entriesView([assistantMessage('step-a', [doneTool('call-a', 'view', { path: 'a.ts' })]), stepB, stepC]));

    const line = screen.getByRole('group', { name: 'Read files' });
    expect(within(line).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('group', { name: 'Tool: view' })).toHaveLength(3);
    expect(within(rowC()!).getAllByRole('button')[0]).toHaveAttribute('aria-expanded', 'true');
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

    expect(screen.getByRole('group', { name: 'Which auth flow?' })).toBeInTheDocument();
    expect(screen.getByText('Both are supported.')).toBe(settledText);
  });

  it('splits the work around prose, which stays on screen between the lines', () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        { type: 'text', text: 'Interlude' },
        doneTool('call-3', 'view'),
      ]),
    ]);

    expect(stretchLines().map(line => line.getAttribute('aria-label'))).toEqual(['Read files', 'Read src/index.ts']);
    expect(screen.getByText('Interlude').closest('[data-slot="activity-stretch"]')).toBeNull();
  });

  it.each([
    ['ask_user', 'Which file should I edit?', { question: 'Which file should I edit?' }],
    ['submit_plan', 'Plan approval', { plan: { title: 'Ship the fix', content: 'Step one' } }],
    ['skill', 'Skill: understand-issue', { name: 'understand-issue' }],
  ])('splits the work on %s so its card is never swallowed by a line', (toolName, promptLabel, args) => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        doneTool('call-3', toolName, args),
        doneTool('call-4', 'view'),
        doneTool('call-5', 'view'),
      ]),
    ]);

    expect(stretchLines()).toHaveLength(2);
    const card = screen.getByRole('group', { name: promptLabel });
    expect(card.closest('[data-slot="activity-stretch"]')).toBeNull();
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

  it('splits the work on a suspended call so the agent question stays answerable', () => {
    renderEntries([
      assistantMessage('msg-1', [
        doneTool('call-1', 'view'),
        doneTool('call-2', 'view'),
        runningTool('call-3', 'ask_user', { question: 'Which file should I edit?' }),
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

    expect(stretchLines()).toHaveLength(2);
    const question = screen.getByRole('group', { name: 'Which file should I edit?' });
    expect(question.closest('[data-slot="activity-stretch"]')).toBeNull();
    expect(within(question).getByText('Which file should I edit?')).toBeInTheDocument();
  });

  it('splits the work at a waiting ask_user so nothing regroups when its prompt lands', () => {
    const message = assistantMessage('msg-1', [
      doneTool('call-1', 'view'),
      doneTool('call-2', 'view'),
      doneTool('call-3', 'view'),
      runningTool('call-4', 'ask_user', {}),
      doneTool('call-5', 'view'),
    ]);
    const { rerender } = renderEntries([message]);

    const [before, after] = stretchLines();
    expect(stretchLines().map(line => line.getAttribute('aria-label'))).toEqual(['Read files', 'Read src/index.ts']);
    expect(screen.queryByRole('group', { name: 'Which file should I edit?' })).not.toBeInTheDocument();

    rerender(
      entriesView([
        message,
        {
          kind: 'suspension',
          id: 'susp-1',
          toolCallId: 'call-4',
          toolName: 'ask_user',
          args: {},
          suspendPayload: { question: 'Which file should I edit?' },
        },
      ]),
    );

    expect(stretchLines()).toEqual([before, after]);
    expect(screen.getByRole('group', { name: 'Which file should I edit?' })).toBeInTheDocument();
  });

  it('trusts the persisted result over a stale running overlay — a lost tool_end must not spin forever', () => {
    renderEntries([
      assistantMessage('msg-1', [doneTool('call-1', 'view')], {
        'call-1': { toolCallId: 'call-1', toolName: 'view', argsText: '', status: 'running', output: '' },
      }),
    ]);

    const row = screen.getByRole('group', { name: 'Read src/index.ts' });
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

    const row = screen.getByRole('group', { name: 'Wrote' });
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

      const row = screen.getByRole('group', { name: 'Wrote' });
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

    const userBubbleWrapper = screen.getByText('Please run the tests').closest('.ml-auto');
    expect(userBubbleWrapper).toHaveClass('my-3');

    const assistantProse = screen.getByText('All 36 tests passed.').closest('.mastra-markdown');
    expect(assistantProse).toHaveClass('my-3');
  });

  describe('local timestamps', () => {
    const PART_AT = new Date('2026-07-15T10:03:42.000Z');

    function clockTime(line: HTMLElement, at: Date): HTMLElement {
      const time = line.querySelector<HTMLElement>(`time[datetime="${at.toISOString()}"]`);
      if (!time) throw new Error(`no clock for ${at.toISOString()}`);
      return time;
    }

    function localClock(date: Date): string {
      const text = formatDate(date, 'time-seconds');
      if (text === undefined) throw new Error(`${date.toISOString()} is not a valid date`);
      return text;
    }

    it('names the moment core stamped on the call, in local time, when the reader hovers the line', async () => {
      renderEntries([
        assistantMessage('msg-1', [
          { ...doneTool('call-1', 'execute_command', { command: 'pnpm build' }), createdAt: PART_AT.getTime() },
        ]),
      ]);

      const line = screen.getByRole('group', { name: 'Ran pnpm build' });
      const time = clockTime(line, PART_AT);
      expect(time.textContent).toContain(localClock(PART_AT));

      await userEvent.hover(within(line).getAllByRole('button')[0]);
      expect(await screen.findByText(time.textContent ?? '', { selector: ':not(time)' })).toBeVisible();
    });

    it('falls back to the message time for calls core never stamped', () => {
      renderEntries([assistantMessage('msg-1', [doneTool('call-1', 'view')])]);

      expect(clockTime(screen.getByRole('group', { name: 'Read src/index.ts' }), CREATED_AT)).toBeInTheDocument();
    });

    it('leads a line of several calls with the time its first call began', () => {
      renderEntries([
        assistantMessage('msg-1', [
          { ...doneTool('call-1', 'view'), createdAt: PART_AT.getTime() },
          { ...doneTool('call-2', 'search_content'), createdAt: PART_AT.getTime() + 1000 },
          { ...doneTool('call-3', 'view'), createdAt: PART_AT.getTime() + 2000 },
        ]),
      ]);

      const line = screen.getByRole('group', { name: 'Read files, searched code' });
      expect(clockTime(line, PART_AT)).toBeInTheDocument();
      expect(line.querySelector(`time[datetime="${new Date(PART_AT.getTime() + 2000).toISOString()}"]`)).toBeNull();
    });
  });
});
