import { Container } from '@earendil-works/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { describe, expect, it, vi } from 'vitest';

import { isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { UserMessageComponent } from './components/user-message.js';
import { addUserMessage, renderExistingMessages } from './render-messages.js';
import type { TUIState } from './state.js';

function visibleChildren(state: TUIState) {
  return state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

function createRestoreDisplayTasks(displayState: { tasks?: unknown[]; previousTasks?: unknown[] }) {
  return vi.fn((tasks: unknown[]) => {
    displayState.previousTasks = displayState.tasks ? [...displayState.tasks] : [];
    displayState.tasks = [...tasks];
  });
}

function createSessionState(state: Record<string, unknown> = {}, setState = vi.fn().mockResolvedValue(undefined)) {
  return { get: vi.fn(() => state), set: setState };
}

function createState(): TUIState {
  const displayState = { isRunning: false, tasks: [], previousTasks: [] };
  const sessionState = createSessionState();
  return {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
    toolOutputExpanded: false,
    allSystemReminderComponents: [],
    allSlashCommandComponents: [],
    allToolComponents: [],
    pendingTools: new Map(),
    pendingSubagents: new Map(),
    allShellComponents: [],
    messageComponentsById: new Map(),
    pendingSignalMessageComponentsById: new Map(),
    followUpComponents: [],
    quietMode: false,
    session: {
      state: sessionState,
      mode: { resolve: vi.fn(() => ({ metadata: {} })) },
      thread: { listActiveMessages: vi.fn().mockResolvedValue([]) },
    },
    harness: {
      session: { displayState: { get: () => displayState, restoreTasks: createRestoreDisplayTasks(displayState) } },
      setState: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as TUIState;
}

function createUserMessage(text: string, id = 'user-1'): HarnessMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
  } as HarnessMessage;
}

function createReminderMessage(
  reminder: Extract<HarnessMessage['content'][number], { type: 'system_reminder' }>,
  id = '__temporal_1',
): HarnessMessage {
  return {
    id,
    role: 'user',
    content: [reminder],
  } as HarnessMessage;
}

describe('addUserMessage', () => {
  it('renders a persisted temporal-gap marker from canonical system reminder content', () => {
    const state = createState();

    addUserMessage(
      state,
      createReminderMessage({
        type: 'system_reminder',
        reminderType: 'temporal-gap',
        message: '15 minutes later — 9:15 AM',
        gapText: '15 minutes later',
      }),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(TemporalGapComponent);
    expect((state.chatContainer.children[0] as TemporalGapComponent).render(80).join('\n')).toContain(
      '⏳ 15 minutes later',
    );
    expect(state.messageComponentsById.size).toBe(0);
  });

  it('anchors a persisted temporal-gap marker before its target message when precedesMessageId is present', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('Real user message', 'user-1'));
    addUserMessage(
      state,
      createReminderMessage({
        type: 'system_reminder',
        reminderType: 'temporal-gap',
        message: '15 minutes later — 9:15 AM',
        gapText: '15 minutes later',
        precedesMessageId: 'user-1',
      }),
    );

    const children = visibleChildren(state);
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(TemporalGapComponent);
    expect(children[1]).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('user-1')).toBe(children[1]);
  });

  it('renders a legacy persisted temporal-gap marker from whole-message XML', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage(
        '<system-reminder type="temporal-gap" precedesMessageId="user-1">15 minutes later — 9:15 AM</system-reminder>',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(TemporalGapComponent);
    expect((state.chatContainer.children[0] as TemporalGapComponent).render(80).join('\n')).toContain(
      '⏳ 15 minutes later',
    );
    expect(state.allSystemReminderComponents).toHaveLength(1);
  });

  it('keeps normal user text visible when it merely quotes a system-reminder tag', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage(
        'ok with latest changes it still shows in the wrong order <system-reminder type="temporal-gap">15 minutes later</system-reminder> anyway it is not working',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(UserMessageComponent);
    expect(state.allSystemReminderComponents).toHaveLength(0);
    expect(state.messageComponentsById.get('user-1')).toBe(state.chatContainer.children[0]);
  });
});

describe('renderExistingMessages startup history loading', () => {
  it('loads only the visible startup window and renders returned messages in order', async () => {
    const messages = [createUserMessage('first', 'user-1'), createUserMessage('second', 'user-2')];
    const state = createState();
    const listActiveMessages = vi.fn().mockResolvedValue(messages);
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(listActiveMessages).toHaveBeenCalledWith({ limit: 200 });
    const children = visibleChildren(state);
    expect(children).toHaveLength(2);
    expect(state.messageComponentsById.get('user-1')).toBe(children[0]);
    expect(state.messageComponentsById.get('user-2')).toBe(children[1]);
  });

  it('tracks the latest rendered message timestamp for startup idle state', async () => {
    const latest = new Date('2026-05-15T13:30:00.000Z');
    const messages = [
      { ...createUserMessage('first', 'user-1'), createdAt: new Date('2026-05-15T13:00:00.000Z') },
      { ...createUserMessage('second', 'user-2'), createdAt: latest },
    ] as HarnessMessage[];
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(state.lastRenderedMessageAt).toBe(latest.getTime());
  });

  it('does not clear existing task display state when the bounded startup window has no task snapshot', async () => {
    const messages = [createUserMessage('recent', 'user-1')];
    const existingTasks = [{ id: 'old-task', content: 'Old task', status: 'pending', activeForm: 'Working' }];
    const state = createState();
    const listActiveMessages = vi.fn().mockResolvedValue(messages);
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    const restoreDisplayTasks = vi.fn();
    state.taskProgress = { updateTasks, getTasks: () => existingTasks } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages },
      state: createSessionState({ tasks: existingTasks }, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages },
        displayState: {
          get: () => ({ isRunning: false, tasks: existingTasks, previousTasks: [] }),
          restoreTasks: restoreDisplayTasks,
        },
      },
      getState: () => ({ tasks: existingTasks }),
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(listActiveMessages).toHaveBeenCalledWith({ limit: 200 });
    expect(updateTasks).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    expect(restoreDisplayTasks).not.toHaveBeenCalled();
  });
});

describe('renderExistingMessages subagents', () => {
  it('uses the current model id for persisted forked subagents when no metadata tag is present', async () => {
    const message: HarnessMessage = {
      id: 'assistant-1',
      role: 'assistant',
      createdAt: new Date(),
      content: [
        {
          type: 'tool_call',
          id: 'tool-1',
          name: 'subagent',
          args: {
            agentType: 'explore',
            task: 'Summarize the thread',
            forked: true,
          },
        },
        {
          type: 'tool_result',
          id: 'tool-1',
          name: 'subagent',
          result: 'summary text',
          isError: false,
        },
      ],
    };
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
        model: { get: () => 'openai/gpt-5.5' },
        state: { set: vi.fn().mockResolvedValue(undefined) },
      },
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(SubagentExecutionComponent);
    const rendered = (state.chatContainer.children[0] as SubagentExecutionComponent)
      .render(100)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('subagent fork openai/gpt-5.5');
  });
});

describe('renderExistingMessages task tools', () => {
  it('replays task patch results into the pinned task list', async () => {
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: {
              tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: {
              content: 'Tasks updated',
              tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'task_update',
            args: { id: 'tests', status: 'in_progress' },
          },
          {
            type: 'tool_result',
            id: 'tool-2',
            name: 'task_update',
            result: {
              content: 'Tasks updated',
              tasks: [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    const displayState = { isRunning: false, tasks: [], previousTasks: [] };
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => displayState, restoreTasks: createRestoreDisplayTasks(displayState) },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(updateTasks).toHaveBeenCalledWith([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
    expect(setState).toHaveBeenCalledWith({
      tasks: [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }],
    });
    expect(displayState.tasks).toEqual([
      { id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ]);
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('replays task_check result snapshots into the pinned task list', async () => {
    const checkedTasks = [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }];
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_check',
            args: {},
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_check',
            result: {
              content: 'Task Status: [0/1 completed]',
              tasks: checkedTasks,
              summary: {
                total: 1,
                completed: 0,
                inProgress: 0,
                pending: 1,
                incomplete: 1,
                hasTasks: true,
                allCompleted: false,
              },
              incompleteTasks: checkedTasks,
              isError: false,
            },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    const displayState = { isRunning: false, tasks: [], previousTasks: [] };
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => displayState, restoreTasks: createRestoreDisplayTasks(displayState) },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(updateTasks).toHaveBeenCalledWith(checkedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: checkedTasks });
    expect(displayState.tasks).toEqual(checkedTasks);
  });

  it('replays early task patch history without structured task snapshots', async () => {
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: {
              tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: {
              content: 'Tasks updated',
              tasks: [{ content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'task_update',
            args: { id: 'task_write_tests', status: 'in_progress' },
          },
          {
            type: 'tool_result',
            id: 'tool-2',
            name: 'task_update',
            result: { content: 'Tasks updated' },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const expectedTasks = [
      { id: 'task_write_tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
    ];
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
  });

  it('keeps replayed task state local when harness state schema rejects tasks', async () => {
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: {
              tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: { content: 'Tasks updated' },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockRejectedValue(new Error('Invalid state update'));
    const displayState = { isRunning: false, tasks: [], previousTasks: [] };
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => displayState, restoreTasks: createRestoreDisplayTasks(displayState) },
      },
      setState,
    } as unknown as TUIState['harness'];

    await expect(renderExistingMessages(state)).resolves.toBeUndefined();

    const expectedTasks = [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }];
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
    expect(displayState).toMatchObject({ tasks: expectedTasks, previousTasks: [] });
  });

  it('does not reuse previous IDs by order when replaying duplicate task content', async () => {
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: {
              tasks: [
                { id: 'first', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
                { id: 'second', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
              ],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: {
              content: 'Tasks updated',
              tasks: [
                { id: 'first', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff' },
                { id: 'second', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
              ],
            },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'task_write',
            args: {
              tasks: [
                { content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
                { content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
              ],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-2',
            name: 'task_write',
            result: { content: 'Tasks updated' },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const expectedTasks = [
      { id: 'task_review_diff', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
      { id: 'task_review_diff_2', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
    ];
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
  });

  it('restores task state from snapshots in the bounded rendered window', async () => {
    const fillerMessages = Array.from({ length: 39 }, (_, index): HarnessMessage => {
      return {
        id: `user-${index}`,
        role: 'user',
        createdAt: new Date(),
        content: [{ type: 'text', text: `Message ${index}` }],
      };
    });
    const visibleTaskUpdate: HarnessMessage = {
      id: 'assistant-visible',
      role: 'assistant',
      createdAt: new Date(),
      content: [
        {
          type: 'tool_call',
          id: 'tool-2',
          name: 'task_update',
          args: { id: 'tests', status: 'in_progress' },
        },
        {
          type: 'tool_result',
          id: 'tool-2',
          name: 'task_update',
          result: {
            content: 'Tasks updated',
            tasks: [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }],
          },
          isError: false,
        },
      ],
    };
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    const listActiveMessages = vi.fn().mockResolvedValue([...fillerMessages, visibleTaskUpdate]);
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const expectedTasks = [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }];
    expect(listActiveMessages).toHaveBeenCalledWith({ limit: 200 });
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
    expect(visibleChildren(state)).toHaveLength(39);
  });

  it('renders no inline receipt when replaying repeated complete patches that finish the list', async () => {
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: {
              tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: {
              content: 'Tasks updated',
              tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'task_complete',
            args: { id: 'tests' },
          },
          {
            type: 'tool_result',
            id: 'tool-2',
            name: 'task_complete',
            result: {
              content: 'Tasks updated',
              tasks: [{ id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-3',
            name: 'task_complete',
            args: { id: 'tests' },
          },
          {
            type: 'tool_result',
            id: 'tool-3',
            name: 'task_complete',
            result: {
              content: 'Tasks updated',
              tasks: [{ id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' }],
            },
            isError: false,
          },
        ],
      },
    ];
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    // A fully-completed list leaves no inline receipt in the transcript.
    expect(visibleChildren(state)).toHaveLength(0);
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('renders no inline receipt when replaying repeated completed task writes', async () => {
    const completedTasks = [{ id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' }];
    const messages: HarnessMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(),
        content: [
          {
            type: 'tool_call',
            id: 'tool-1',
            name: 'task_write',
            args: { tasks: completedTasks },
          },
          {
            type: 'tool_result',
            id: 'tool-1',
            name: 'task_write',
            result: { content: 'Tasks updated', tasks: completedTasks },
            isError: false,
          },
          {
            type: 'tool_call',
            id: 'tool-2',
            name: 'task_write',
            args: { tasks: completedTasks },
          },
          {
            type: 'tool_result',
            id: 'tool-2',
            name: 'task_write',
            result: { content: 'Tasks updated', tasks: completedTasks },
            isError: false,
          },
        ],
      },
    ] as HarnessMessage[];
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: vi.fn() },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    // A fully-completed list leaves no inline receipt in the transcript.
    expect(visibleChildren(state)).toHaveLength(0);
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('preserves the pinned task list when bounded history has no task snapshots', async () => {
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    const restoreDisplayTasks = vi.fn();
    state.taskProgress = {
      updateTasks,
      getTasks: () => [{ id: 'old', content: 'Old task', status: 'pending', activeForm: 'Doing old task' }],
    } as unknown as TUIState['taskProgress'];
    state.session = {
      ...(state.session as any),
      thread: { listActiveMessages: vi.fn().mockResolvedValue([]) },
      state: createSessionState({}, setState),
    } as unknown as TUIState['session'];
    state.harness = {
      session: {
        thread: { listActiveMessages: vi.fn().mockResolvedValue([]) },
        displayState: { get: () => ({ isRunning: false }), restoreTasks: restoreDisplayTasks },
      },
      setState,
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(updateTasks).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    expect(restoreDisplayTasks).not.toHaveBeenCalled();
  });
});
