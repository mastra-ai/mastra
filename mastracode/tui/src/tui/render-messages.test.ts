import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Container } from '@earendil-works/pi-tui';
import { getLocalPlansDir, getPlanFilename, getSuggestedPlanRelativePath } from '@mastra/code-sdk/utils/plans';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { TaskItemSnapshot } from '@mastra/core/signals';
import { createSignal } from '@mastra/core/signals';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AssistantRenderRegistry } from './assistant-render-registry.js';
import { isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { JudgeDisplayComponent } from './components/judge-display.js';
import { ReactiveSignalComponent } from './components/reactive-signal.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { TaskProgressComponent } from './components/task-progress.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { UserMessageComponent } from './components/user-message.js';
import {
  addPendingUserMessage,
  addUserMessage as renderUserMessage,
  renderExistingMessages,
} from './render-messages.js';
import type { TUIState } from './state.js';

function visibleChildren(state: TUIState) {
  return state.chatContainer.children.filter(child => !isChatBoundarySpacer(child));
}

function addUserMessage(state: TUIState, message: MastraDBMessage): void {
  renderUserMessage(state, message);
}

const tmpProjects: string[] = [];
const TEST_THREAD_ID = 'thread-test-render-messages';
const PLAN_TITLE = 'My Plan';
const PLAN_PATH = getSuggestedPlanRelativePath(PLAN_TITLE);

function createTmpProjectWithPlan(title: string, plan: string, filename = getPlanFilename(title)): string {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-render-test-'));
  tmpProjects.push(projectPath);
  const planPath = path.join(getLocalPlansDir(projectPath), filename);
  fs.mkdirSync(path.dirname(planPath), { recursive: true });
  fs.writeFileSync(planPath, `# ${title}\n\n${plan}\n`, 'utf-8');
  return projectPath;
}

afterEach(() => {
  while (tmpProjects.length) {
    const dir = tmpProjects.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createSessionState(state: Record<string, unknown> = {}, setState = vi.fn().mockResolvedValue(undefined)) {
  return { get: vi.fn(() => state), set: setState };
}

function createState(): TUIState {
  const displayState = { isRunning: false, tasks: [], previousTasks: [] };
  const sessionState = createSessionState();
  const session = {
    state: sessionState,
    mode: { resolve: vi.fn(() => ({ metadata: {} })) },
    model: { get: vi.fn(() => 'anthropic/claude-sonnet-4') },
    thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue([]) },
    displayState: { get: () => displayState },
  };
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
    assistantRenderRegistry: new AssistantRenderRegistry(),
    messageComponentsById: new Map(),
    pendingSignalMessageComponentsById: new Map(),
    followUpComponents: [],
    quietMode: false,
    session,
    controller: {
      session,
      setState: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as TUIState;
}

/**
 * Legacy flat content shapes used only to build DB-native fixtures below.
 * The renderer no longer consumes these; `flatToDb` converts them into the
 * canonical `MastraDBMessage` (`content.parts`) shape the TUI now reads.
 */
type FlatTextPart = { type: 'text'; text: string };
type FlatToolCallPart = { type: 'tool_call'; id: string; name: string; args: unknown };
type FlatToolResultPart = { type: 'tool_result'; id: string; name: string; result: unknown; isError?: boolean };
type FlatContentPart = FlatTextPart | FlatToolCallPart | FlatToolResultPart;

function flatToParts(content: FlatContentPart[]): MastraDBMessage['content']['parts'] {
  const parts: MastraDBMessage['content']['parts'] = [];
  for (const item of content) {
    if (item.type === 'text') {
      parts.push({ type: 'text', text: item.text });
    } else if (item.type === 'tool_call') {
      parts.push({
        type: 'tool-invocation',
        toolInvocation: { toolCallId: item.id, toolName: item.name, args: item.args, state: 'call' },
      } as never);
    } else if (item.type === 'tool_result') {
      const existing = parts.find(
        part =>
          (part as { type?: string }).type === 'tool-invocation' &&
          (part as { toolInvocation?: { toolCallId?: string } }).toolInvocation?.toolCallId === item.id,
      ) as { toolInvocation?: Record<string, unknown> } | undefined;
      if (existing?.toolInvocation) {
        existing.toolInvocation.state = 'result';
        existing.toolInvocation.result = item.result;
      } else {
        parts.push({
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: item.id,
            toolName: item.name,
            args: {},
            state: 'result',
            result: item.result,
          },
        } as never);
      }
    }
  }
  return parts;
}

function dbMessage(
  role: MastraDBMessage['role'],
  content: FlatContentPart[],
  id: string,
  extra: Partial<MastraDBMessage> = {},
): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date(),
    content: { format: 2, parts: flatToParts(content) },
    ...extra,
  } as MastraDBMessage;
}

function createUserMessage(text: string, id = 'user-1'): MastraDBMessage {
  return dbMessage('user', [{ type: 'text', text }], id);
}

interface LegacyMessage {
  id: string;
  role: MastraDBMessage['role'];
  createdAt?: Date;
  content: FlatContentPart[];
}

function toDbMessages(messages: LegacyMessage[]): MastraDBMessage[] {
  return messages.map(message =>
    dbMessage(message.role, message.content, message.id, message.createdAt ? { createdAt: message.createdAt } : {}),
  );
}

interface ReminderInput {
  reminderType: string;
  message: string;
  gapText?: string;
  precedesMessageId?: string;
  goalEvaluation?: Record<string, unknown>;
}

function createReminderMessage(reminder: ReminderInput, id = '__temporal_1'): MastraDBMessage {
  const { reminderType, message, gapText, precedesMessageId, goalEvaluation } = reminder;
  return createSignal({
    id,
    type: 'reactive',
    tagName: 'system-reminder',
    contents: message,
    attributes: { type: reminderType, gapText, precedesMessageId },
    metadata: { goalEvaluation },
  } as Parameters<typeof createSignal>[0]).toDBMessage();
}

function createGoalJudgeMessage(id = 'goal-judge-1'): MastraDBMessage {
  return createReminderMessage(
    {
      reminderType: 'goal-judge',
      message: '[Goal attempt 2/20] The goal is not yet complete. Judge feedback: Need another fact.',
      goalEvaluation: {
        objective: 'List whale facts',
        iteration: 2,
        maxRuns: 20,
        passed: false,
        status: 'active',
        results: [],
        reason: 'Need another fact.',
        duration: 0,
        timedOut: false,
        maxRunsReached: false,
        suppressFeedback: false,
      },
    },
    id,
  );
}

describe('addUserMessage', () => {
  it('renders a persisted temporal-gap marker from canonical system reminder content', () => {
    const state = createState();

    addUserMessage(
      state,
      createReminderMessage({
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

  it('renders and registers persisted goal-judge evaluations', () => {
    const state = createState();

    renderUserMessage(state, createGoalJudgeMessage());

    const children = visibleChildren(state);
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(JudgeDisplayComponent);
    expect(state.messageComponentsById.get('goal-judge-1')).toBe(children[0]);
  });

  it('renders non-goal signals through the shared signal renderer', () => {
    const state = createState();
    const message = createSignal({
      id: 'build-status',
      type: 'reactive',
      tagName: 'build-status',
      contents: 'Build is still running',
    }).toDBMessage();

    renderUserMessage(state, message);

    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(ReactiveSignalComponent);
    expect(state.messageComponentsById.get('build-status')).toBe(component);
  });

  it('renders user-kind signal text, attachments, and delivery label from signal contents', () => {
    const state = createState();
    const message = createSignal({
      id: 'steer-signal',
      type: 'user',
      contents: [
        { type: 'text', text: 'Use the new direction' },
        { type: 'file', data: 'image-data', mediaType: 'image/png' },
        { type: 'file', data: 'file-data', mediaType: 'text/plain' },
      ],
      attributes: { delivery: 'while-active' },
    }).toDBMessage();

    renderUserMessage(state, message);

    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('steer-signal')).toBe(component);
    const rendered = (component as UserMessageComponent).render(100).join('\n');
    expect(rendered).toContain('steer');
    expect(rendered).toContain('[1 image] [1 file] Use the new direction');
  });

  it('preserves canonical attachments when a user-kind signal confirms a pending steer', () => {
    const state = createState();
    addPendingUserMessage(state, 'steer-signal', 'Use the new direction', undefined, { isInterjection: true });
    const message = createSignal({
      id: 'steer-signal',
      type: 'user',
      contents: [
        { type: 'text', text: 'Use the new direction' },
        { type: 'file', data: 'image-data', mediaType: 'image/png' },
        { type: 'file', data: 'file-data', mediaType: 'text/plain' },
      ],
      attributes: { delivery: 'while-active' },
    }).toDBMessage();

    renderUserMessage(state, message);

    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(UserMessageComponent);
    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.messageComponentsById.get('steer-signal')).toBe(component);
    const rendered = (component as UserMessageComponent).render(100).join('\n');
    expect(rendered).toContain('steer');
    expect(rendered).toContain('[1 image] [1 file] Use the new direction');
  });

  it('anchors a persisted temporal-gap marker before its target message when precedesMessageId is present', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('Real user message', 'user-1'));
    addUserMessage(
      state,
      createReminderMessage({
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
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    expect(listActiveMessages).toHaveBeenCalledWith({ limit: 200 });
    const children = visibleChildren(state);
    expect(children).toHaveLength(2);
    expect(state.messageComponentsById.get('user-1')).toBe(children[0]);
    expect(state.messageComponentsById.get('user-2')).toBe(children[1]);
  });

  it('reconstructs one persisted goal-judge evaluation from history', async () => {
    const state = createState();
    const listActiveMessages = vi.fn().mockResolvedValue([createGoalJudgeMessage()]);
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    const children = visibleChildren(state);
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(JudgeDisplayComponent);
    expect(state.messageComponentsById.get('goal-judge-1')).toBe(children[0]);
  });

  it('reconstructs a persisted DB-native user signal from history', async () => {
    const state = createState();
    const userSignal = createSignal({
      id: 'steer-history',
      type: 'user',
      contents: 'Continue from history',
      attributes: { delivery: 'while-active' },
    }).toDBMessage();
    const listActiveMessages = vi.fn().mockResolvedValue([userSignal]);
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    const component = visibleChildren(state)[0];
    expect(component).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('steer-history')).toBe(component);
    const rendered = (component as UserMessageComponent).render(100).join('\n');
    expect(rendered).toContain('steer');
    expect(rendered).toContain('Continue from history');
  });

  it('renders the interrupted line once at the end for an aborted assistant message with tool calls', async () => {
    const assistant = dbMessage(
      'assistant',
      [
        { type: 'text', text: 'before tool' },
        { type: 'tool_call', id: 'tool-1', name: 'view', args: { path: 'a.ts' } },
        { type: 'tool_result', id: 'tool-1', name: 'view', result: 'ok' },
        { type: 'text', text: 'after tool' },
      ],
      'assistant-1',
    );
    (assistant.content as { metadata?: Record<string, unknown> }).metadata = { stopReason: 'aborted' };
    const messages = [createUserMessage('hi', 'user-1'), assistant];
    const state = createState();
    const listActiveMessages = vi.fn().mockResolvedValue(messages);
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    const rendered = visibleChildren(state).map(child =>
      (child as { render(width: number): string[] }).render(120).join('\n'),
    );
    const interruptedSlices = rendered.filter(text => text.includes('Interrupted'));
    expect(interruptedSlices).toHaveLength(1);
    expect(rendered[rendered.length - 1]).toContain('after tool');
    expect(rendered[rendered.length - 1]).toContain('Interrupted');
  });

  it('tracks the latest rendered message timestamp for startup idle state', async () => {
    const latest = new Date('2026-05-15T13:30:00.000Z');
    const messages = [
      { ...createUserMessage('first', 'user-1'), createdAt: new Date('2026-05-15T13:00:00.000Z') },
      { ...createUserMessage('second', 'user-2'), createdAt: latest },
    ];
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    expect(state.lastRenderedMessageAt).toBe(latest.getTime());
  });

  it('hydrates the pinned panel from the session when current tasks lie outside the history window', async () => {
    const state = createState();
    const existingTasks = [
      { id: 'old-task', content: 'Old task', status: 'pending', activeForm: 'Working' },
    ] satisfies TaskItemSnapshot[];
    state.session.displayState.get().tasks = existingTasks;
    state.taskProgress = new TaskProgressComponent();
    const listActiveMessages = vi
      .spyOn(state.session.thread, 'listActiveMessages')
      .mockResolvedValue([createUserMessage('recent', 'user-1')]);

    await renderExistingMessages(state);

    expect(listActiveMessages).toHaveBeenCalledWith({ limit: 200 });
    expect(state.taskProgress.getTasks()).toEqual(existingTasks);
    expect(state.taskProgress.render(100).join('\n')).toContain('Old task');
    expect(state.session.state.set).not.toHaveBeenCalled();
  });
});

describe('renderExistingMessages subagents', () => {
  it('uses the current model id for persisted forked subagents when no metadata tag is present', async () => {
    const message = dbMessage(
      'assistant',
      [
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
      'assistant-1',
    );
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue([message]) },
      state: createSessionState(),
      displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      model: { get: () => 'openai/gpt-5.5' },
    } as unknown as TUIState['session'];
    state.controller = {
      session: state.session,
    } as unknown as TUIState['controller'];

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
  it('renders historical transitions without replacing newer canonical tasks', async () => {
    const state = createState();
    const currentTasks = [
      { id: 'deploy', content: 'Deploy release', status: 'pending', activeForm: 'Deploying release' },
    ] satisfies TaskItemSnapshot[];
    state.session.displayState.get().tasks = currentTasks;
    state.taskProgress = new TaskProgressComponent();
    vi.spyOn(state.session.thread, 'listActiveMessages').mockResolvedValue([
      dbMessage(
        'assistant',
        [
          {
            type: 'tool_call',
            id: 'write',
            name: 'task_write',
            args: { tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }] },
          },
          { type: 'tool_result', id: 'write', name: 'task_write', result: { content: 'Tasks updated' } },
          {
            type: 'tool_call',
            id: 'complete',
            name: 'task_complete',
            args: { id: 'tests' },
          },
          { type: 'tool_result', id: 'complete', name: 'task_complete', result: { content: 'Tasks updated' } },
        ],
        'historical-task-transitions',
      ),
    ]);

    await renderExistingMessages(state);

    const transcript = state.chatContainer.render(100).join('\n');
    expect(transcript).toContain('Write tests');
    expect(transcript).toContain('[1/1 completed]');
    expect(state.taskProgress.getTasks()).toEqual(currentTasks);
    expect(state.taskProgress.render(100).join('\n')).toContain('Deploy release');
    expect(state.session.displayState.get().tasks).toEqual(currentTasks);
    expect(state.session.state.set).not.toHaveBeenCalled();
  });

  it('does not revive cloned tasks from historical task_check results', async () => {
    const state = createState();
    state.taskProgress = new TaskProgressComponent();
    vi.spyOn(state.session.thread, 'listActiveMessages').mockResolvedValue([
      dbMessage(
        'assistant',
        [
          { type: 'tool_call', id: 'check', name: 'task_check', args: {} },
          {
            type: 'tool_result',
            id: 'check',
            name: 'task_check',
            result: {
              content: 'Task Status: [0/1 completed]',
              tasks: [{ id: 'source', content: 'Source task', status: 'pending', activeForm: 'Working' }],
            },
          },
        ],
        'cloned-task-check',
      ),
    ]);

    await renderExistingMessages(state);

    expect(state.chatContainer.render(100).join('\n')).toContain('Task Status: [0/1 completed]');
    expect(state.taskProgress.getTasks()).toEqual([]);
    expect(state.session.displayState.get().tasks).toEqual([]);
    expect(state.session.state.set).not.toHaveBeenCalled();
  });

  it('renders inline receipts when replaying repeated complete patches that finish the list', async () => {
    const messages = toDbMessages([
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
    ]);
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    const rendered = visibleChildren(state).map(component => component.render(100).join('\n'));
    expect(rendered).toHaveLength(3);
    expect(rendered.join('\n')).toContain('Write tests');
    expect(rendered.join('\n')).toContain('Tasks');
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });

  it('renders completed task receipts when replaying repeated completed task writes', async () => {
    const completedTasks = [{ id: 'tests', content: 'Write tests', status: 'completed', activeForm: 'Writing tests' }];
    const messages = toDbMessages([
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
    ]);
    const state = createState();
    state.session = {
      ...(state.session as any),
      thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
      state: createSessionState(),
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        thread: { getId: vi.fn(() => TEST_THREAD_ID), listActiveMessages: vi.fn().mockResolvedValue(messages) },
        displayState: { get: () => ({ isRunning: false, tasks: [] }) },
      },
      setState: vi.fn().mockResolvedValue(undefined),
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    const rendered = visibleChildren(state).map(component => component.render(100).join('\n'));
    expect(rendered).toHaveLength(2);
    expect(rendered.join('\n')).toContain('Write tests');
    expect(state.allToolComponents.map(component => (component as any).toolName)).toEqual([]);
  });
});

describe('renderExistingMessages submit_plan approval status', () => {
  it('renders rejected plan as "Changes requested", not "Approved"', async () => {
    const projectPath = createTmpProjectWithPlan('My Plan', 'Step 1\nStep 2');
    const state = createState();
    (state.session.state.get as any).mockReturnValue({ projectPath });
    (state.session.thread.listActiveMessages as any).mockResolvedValue(
      toDbMessages([
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: 'call-1',
              name: 'submit_plan',
              args: { path: PLAN_PATH },
            },
            {
              type: 'tool_result',
              id: 'call-1',
              name: 'submit_plan',
              result: {
                content:
                  'Plan was not approved. The user wants revisions.\n\nUser feedback: Add more tests\n\nPlease revise the plan based on the feedback and submit again with submit_plan.',
                submittedPlan: { title: PLAN_TITLE, path: PLAN_PATH, plan: 'Step 1\nStep 2' },
              },
              isError: false,
            },
          ],
        },
      ]),
    );

    await renderExistingMessages(state);

    const rendered = visibleChildren(state)
      .map(c => (c as any).render?.(120) ?? [])
      .flat()
      .join('\n');
    // Should NOT contain "Approved" — the plan was rejected
    expect(rendered).not.toContain('Approved');
    // Should contain "Changes requested"
    expect(rendered).toContain('Changes requested');
    // Should restore previousPlanSnapshot (keyed by path) for future diff computation
    expect(state.previousPlanSnapshot).toEqual({ path: PLAN_PATH, plan: 'Step 1\nStep 2' });
  });

  it('renders approved plan as "Approved"', async () => {
    const state = createState();
    (state.session.thread.listActiveMessages as any).mockResolvedValue(
      toDbMessages([
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            {
              type: 'tool_call',
              id: 'call-1',
              name: 'submit_plan',
              args: { path: PLAN_PATH },
            },
            {
              type: 'tool_result',
              id: 'call-1',
              name: 'submit_plan',
              result: {
                content: 'Plan approved. Proceed with implementation following the approved plan.',
                submittedPlan: { title: PLAN_TITLE, path: PLAN_PATH, plan: 'Step 1\nStep 2' },
              },
              isError: false,
            },
          ],
        },
      ]),
    );

    await renderExistingMessages(state);

    const rendered = visibleChildren(state)
      .map(c => (c as any).render?.(120) ?? [])
      .flat()
      .join('\n');
    expect(rendered).toContain('Approved');
    expect(rendered).not.toContain('Changes requested');
  });
});
