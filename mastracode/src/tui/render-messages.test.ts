import { Container } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { describe, expect, it, vi } from 'vitest';

import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { UserMessageComponent } from './components/user-message.js';
import { addUserMessage, renderExistingMessages } from './render-messages.js';
import type { TUIState } from './state.js';

function createRestoreDisplayTasks(displayState: { tasks?: unknown[]; previousTasks?: unknown[] }) {
  return vi.fn((tasks: unknown[]) => {
    displayState.previousTasks = displayState.tasks ? [...displayState.tasks] : [];
    displayState.tasks = [...tasks];
  });
}

function createState(): TUIState {
  const displayState = { isRunning: false, tasks: [], previousTasks: [] };
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
    followUpComponents: [],
    quietMode: false,
    harness: {
      getDisplayState: () => displayState,
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: createRestoreDisplayTasks(displayState),
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

    expect(state.chatContainer.children).toHaveLength(2);
    expect(state.chatContainer.children[0]).toBeInstanceOf(TemporalGapComponent);
    expect(state.chatContainer.children[1]).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('user-1')).toBe(state.chatContainer.children[1]);
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue([message]),
      getDisplayState: () => ({ isRunning: false }),
      getFullModelId: () => 'openai/gpt-5.5',
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: vi.fn(),
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => displayState,
      setState,
      restoreDisplayTasks: createRestoreDisplayTasks(displayState),
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => displayState,
      setState,
      restoreDisplayTasks: createRestoreDisplayTasks(displayState),
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState,
      restoreDisplayTasks: vi.fn(),
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
    const displayState = { isRunning: false };
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => displayState,
      setState,
      restoreDisplayTasks: createRestoreDisplayTasks(displayState),
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState,
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const expectedTasks = [
      { id: 'task_review_diff', content: 'Review diff', status: 'in_progress', activeForm: 'Reviewing diff' },
      { id: 'task_review_diff_2', content: 'Review diff', status: 'pending', activeForm: 'Reviewing diff again' },
    ];
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
  });

  it('keeps task state when the original task_write is outside the rendered message window', async () => {
    const oldTaskWrite: HarnessMessage = {
      id: 'assistant-old',
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
      ],
    };
    const fillerMessages = Array.from({ length: 40 }, (_, index): HarnessMessage => {
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
    state.taskProgress = { updateTasks, getTasks: () => [] } as unknown as TUIState['taskProgress'];
    state.harness = {
      listMessages: vi.fn().mockResolvedValue([oldTaskWrite, ...fillerMessages, visibleTaskUpdate]),
      getDisplayState: () => ({ isRunning: false }),
      setState,
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const expectedTasks = [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }];
    expect(updateTasks).toHaveBeenCalledWith(expectedTasks);
    expect(setState).toHaveBeenCalledWith({ tasks: expectedTasks });
    expect(state.chatContainer.children).toHaveLength(39);
  });

  it('renders the completed task list once when replaying repeated complete patches', async () => {
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('renders the completed task list once when replaying repeated completed task writes', async () => {
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
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('keeps completed task replay expanded when quiet mode is disabled', async () => {
    const completedTasks = Array.from({ length: 6 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `Task ${index + 1}`,
      status: 'completed' as const,
      activeForm: `Completing task ${index + 1}`,
    }));
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
        ],
      },
    ] as HarnessMessage[];
    const state = createState();
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const rendered = (state.chatContainer.children[0] as any).render(80).join('\n');
    expect(rendered).toContain('Task 6');
    expect(rendered).not.toContain('more completed');
  });

  it('collapses completed task replay when quiet mode is enabled', async () => {
    const completedTasks = Array.from({ length: 6 }, (_, index) => ({
      id: `task-${index + 1}`,
      content: `Task ${index + 1}`,
      status: 'completed' as const,
      activeForm: `Completing task ${index + 1}`,
    }));
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
        ],
      },
    ] as HarnessMessage[];
    const state = createState();
    state.quietMode = true;
    state.harness = {
      listMessages: vi.fn().mockResolvedValue(messages),
      getDisplayState: () => ({ isRunning: false }),
      setState: vi.fn().mockResolvedValue(undefined),
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    const rendered = (state.chatContainer.children[0] as any).render(80).join('\n');
    expect(rendered).not.toContain('Task 6');
    expect(rendered).toContain('2 more completed tasks');
  });

  it('clears the pinned task list when history has no active tasks', async () => {
    const state = createState();
    const updateTasks = vi.fn();
    const setState = vi.fn().mockResolvedValue(undefined);
    state.taskProgress = {
      updateTasks,
      getTasks: () => [{ id: 'old', content: 'Old task', status: 'pending', activeForm: 'Doing old task' }],
    } as unknown as TUIState['taskProgress'];
    state.harness = {
      listMessages: vi.fn().mockResolvedValue([]),
      getDisplayState: () => ({ isRunning: false }),
      setState,
      restoreDisplayTasks: vi.fn(),
    } as unknown as TUIState['harness'];

    await renderExistingMessages(state);

    expect(updateTasks).toHaveBeenCalledWith([]);
    expect(setState).toHaveBeenCalledWith({ tasks: [] });
  });
});
