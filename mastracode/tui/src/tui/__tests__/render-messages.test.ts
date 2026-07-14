import { Container } from '@earendil-works/pi-tui';
import type { AgentControllerMessage } from '@mastra/core/agent-controller';
import { describe, expect, it, vi } from 'vitest';

import { AssistantMessageComponent } from '../components/assistant-message.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { JudgeDisplayComponent } from '../components/judge-display.js';
import { NotificationSummaryComponent } from '../components/notification-summary.js';
import { NotificationComponent } from '../components/notification.js';
import { ReactiveSignalComponent } from '../components/reactive-signal.js';
import { SlashCommandComponent } from '../components/slash-command.js';
import { StateSignalComponent } from '../components/state-signal.js';
import { SubagentExecutionComponent } from '../components/subagent-execution.js';
import { TemporalGapComponent } from '../components/temporal-gap.js';
import { UserMessageComponent } from '../components/user-message.js';
import { addPendingUserMessage, addUserMessage, renderExistingMessages } from '../render-messages.js';
import type { TUIState } from '../state.js';

function createState(): TUIState {
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
    session: {
      state: {
        get: vi.fn(() => ({})),
        set: vi.fn(),
      },
      displayState: {
        get: () => ({ isRunning: false }),
        restoreTasks: vi.fn(),
      },
    },
  } as unknown as TUIState;
}

function createUserMessage(
  text: string,
  id = 'user-1',
  attributes?: Record<string, string | number | boolean | null | undefined>,
): AgentControllerMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
    attributes,
  } as unknown as AgentControllerMessage;
}

function createReminderMessage(
  reminder: Extract<AgentControllerMessage['content'][number], { type: 'system_reminder' }>,
  id = '__temporal_1',
): AgentControllerMessage {
  return {
    id,
    role: 'user',
    content: [reminder],
  } as AgentControllerMessage;
}

describe('addUserMessage', () => {
  it('replaces pending active steering only when the subscription echoes the user message', () => {
    const state = createState();
    addPendingUserMessage(state, 'signal-1', 'steer me', undefined, { isInterjection: true });
    const pendingComponent = state.chatContainer.children[0];

    addUserMessage(state, createUserMessage('steer me', 'signal-1'));

    expect(state.pendingSignalMessageComponentsById.has('signal-1')).toBe(false);
    const rendered = state.messageComponentsById.get('signal-1');
    expect(rendered).toBeInstanceOf(UserMessageComponent);
    expect(rendered).not.toBe(pendingComponent);
    expect(rendered?.render(80).join('\n')).toContain('steer');
  });

  it('renders state signals as inline state components', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'state-signal-1',
      role: 'user',
      content: [
        {
          type: 'state_signal',
          stateId: 'browser',
          mode: 'delta',
          version: 2,
          message: 'changed: active tab URL changed to https://example.com',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(true);
    expect(state.messageComponentsById.get('state-signal-1')).toBeInstanceOf(StateSignalComponent);
  });

  it('does not render the tasks state signal inline (the pinned task UI shows it)', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'tasks-state-signal-1',
      role: 'user',
      content: [
        {
          type: 'state_signal',
          stateId: 'tasks',
          mode: 'snapshot',
          version: 1,
          message: '<current-task-list>\n  ○ [pending] {id: alpha} Alpha\n</current-task-list>',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
    expect(state.messageComponentsById.has('tasks-state-signal-1')).toBe(false);
  });

  it('does not render the goal state signal inline (the goal/judge UI shows it)', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'goal-state-signal-1',
      role: 'user',
      content: [
        {
          type: 'state_signal',
          stateId: 'goal',
          mode: 'snapshot',
          version: 1,
          message: '<current-objective>\n  Ship the goal feature\n</current-objective>',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof StateSignalComponent)).toBe(false);
    expect(state.messageComponentsById.has('goal-state-signal-1')).toBe(false);
  });

  it('renders generic reactive signals as inline signal components', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'reactive-signal-1',
      role: 'user',
      content: [
        {
          type: 'reactive_signal',
          tagName: 'build-status',
          message: 'Build is still running',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof ReactiveSignalComponent)).toBe(true);
    expect(state.messageComponentsById.get('reactive-signal-1')).toBeInstanceOf(ReactiveSignalComponent);
  });

  it('does not render GitHub subscribe operation signals from history', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'github-subscribe-signal-1',
      role: 'user',
      content: [
        {
          type: 'reactive_signal',
          tagName: 'github-subscribe-pr',
          message: 'Subscribe to GitHub PR #17241',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof ReactiveSignalComponent)).toBe(false);
    expect(state.messageComponentsById.has('github-subscribe-signal-1')).toBe(false);
  });

  it('renders notification summaries as inline notification components', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'notification-summary-1',
      role: 'user',
      content: [
        {
          type: 'notification_summary',
          message: 'mastracode: 1',
          pending: 1,
          bySource: { mastracode: 1 },
          byPriority: { low: 1 },
          notificationIds: ['notification-1'],
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof NotificationSummaryComponent)).toBe(true);
    expect(state.messageComponentsById.get('notification-summary-1')).toBeInstanceOf(NotificationSummaryComponent);
  });

  it('renders full notifications as inline notification components', () => {
    const state = createState();

    addUserMessage(state, {
      id: 'notification-1',
      role: 'user',
      content: [
        {
          type: 'notification',
          message: 'CI failed on main',
          source: 'github',
          kind: 'ci-status',
          priority: 'high',
          status: 'delivered',
        },
      ],
      createdAt: new Date('2026-05-04T00:00:00.000Z'),
    } as unknown as AgentControllerMessage);

    expect(state.chatContainer.children.some(child => child instanceof NotificationComponent)).toBe(true);
    expect(state.messageComponentsById.get('notification-1')).toBeInstanceOf(NotificationComponent);
  });

  it('dedupes echoed slash command messages against the optimistic slash component', () => {
    const state = createState();
    const slashComp = new SlashCommandComponent('deploy', 'custom output');
    state.allSlashCommandComponents.push(slashComp);
    state.chatContainer.addChild(slashComp);

    addUserMessage(
      state,
      createUserMessage('<slash-command name="deploy">\ncustom output\n</slash-command>', 'signal-slash'),
    );

    expect(state.chatContainer.children).toEqual([slashComp]);
    expect(state.messageComponentsById.get('signal-slash')).toBe(slashComp);
  });

  it('removes pending slash command UI when the echoed slash command message arrives', () => {
    const state = createState();
    const slashComp = new SlashCommandComponent('deploy', 'custom output');
    state.allSlashCommandComponents.push(slashComp);
    state.chatContainer.addChild(slashComp);
    addPendingUserMessage(state, 'signal-slash', '/deploy');
    const pending = state.pendingSignalMessageComponentsById.get('signal-slash')?.component;

    addUserMessage(
      state,
      createUserMessage('<slash-command name="deploy">\ncustom output\n</slash-command>', 'signal-slash'),
    );

    expect(state.pendingSignalMessageComponentsById.has('signal-slash')).toBe(false);
    expect(state.messageComponentsById.get('signal-slash')).toBe(slashComp);
    expect(state.chatContainer.children.includes(slashComp as never)).toBe(true);
    expect(state.chatContainer.children.includes(pending as never)).toBe(false);
  });

  it('dedupes echoed <skill> activation messages against the optimistic skill component', () => {
    const state = createState();
    const skillComp = new SlashCommandComponent('skill/github-triage', 'Review the issue.');
    state.allSlashCommandComponents.push(skillComp);
    state.chatContainer.addChild(skillComp);

    addUserMessage(
      state,
      createUserMessage('<skill name="github-triage">\nReview the issue.\n</skill>', 'signal-skill'),
    );

    expect(state.chatContainer.children).toEqual([skillComp]);
    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allSlashCommandComponents).toHaveLength(1);
    expect(state.messageComponentsById.get('signal-skill')).toBe(skillComp);
  });

  it('renders a fresh skill component when replaying a persisted <skill> message with no optimistic component', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage('<skill name="github-triage">\nReview the issue.\n</skill>', 'replay-skill'),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(SlashCommandComponent);
    expect(state.allSlashCommandComponents).toHaveLength(1);
    expect(state.chatContainer.children.some(c => c instanceof UserMessageComponent)).toBe(false);
  });

  it('decodes the </skill> boundary token when replaying a persisted <skill> message', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage(
        '<skill name="github-triage">\nUse <div>, A&B, "quotes". Embedded &lt;/skill&gt; stays out of the way.\n</skill>',
        'escaped-skill',
      ),
    );

    const skillComp = state.chatContainer.children[0] as SlashCommandComponent;
    expect(
      skillComp.matches('skill/github-triage', 'Use <div>, A&B, "quotes". Embedded </skill> stays out of the way.'),
    ).toBe(true);
  });

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

    // 3 children: TemporalGap, boundary-spacer, UserMessage
    expect(state.chatContainer.children).toHaveLength(3);
    expect(state.chatContainer.children[0]).toBeInstanceOf(TemporalGapComponent);
    expect(state.chatContainer.children[2]).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('user-1')).toBe(state.chatContainer.children[2]);
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

  it('renders escaped legacy goal reminders as system reminders', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage(
        '<system-reminder type="goal-judge">[Goal attempt 1/20] Continue &amp; handle &lt;tags&gt;</system-reminder>',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allSystemReminderComponents).toHaveLength(1);
    const rendered = state.allSystemReminderComponents[0]!.render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('Goal');
    expect(rendered).toContain('Continue & handle <tags>');
  });

  it('renders persisted goal-judge evaluations as judge display components', () => {
    const state = createState();

    addUserMessage(
      state,
      createReminderMessage(
        {
          type: 'system_reminder',
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
        } as Extract<AgentControllerMessage['content'][number], { type: 'system_reminder' }>,
        'goal-judge-1',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(JudgeDisplayComponent);
    expect(state.allSystemReminderComponents).toHaveLength(0);
    expect(state.messageComponentsById.get('goal-judge-1')).toBe(state.chatContainer.children[0]);
    const rendered = (state.chatContainer.children[0] as JudgeDisplayComponent)
      .render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('continue');
    expect(rendered).toContain('(2/20)');
    expect(rendered).toContain('Need another fact.');
  });

  it('renders canonical initial goal reminders as system reminders', () => {
    const state = createState();

    addUserMessage(
      state,
      createReminderMessage({
        type: 'system_reminder',
        reminderType: 'goal',
        message: 'Finish the implementation.',
        goalMaxTurns: 20,
        judgeModelId: 'openai/gpt-5.5',
      } as Extract<AgentControllerMessage['content'][number], { type: 'system_reminder' }>),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allSystemReminderComponents).toHaveLength(1);
    const rendered = state.allSystemReminderComponents[0]!.render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('Goal (20 max attempts, judge: openai/gpt-5.5)');
    expect(rendered).toContain('Finish the implementation.');
    expect(rendered).not.toContain('Goal set');
  });

  it('inserts a goal reminder before an active streaming response', () => {
    const state = createState();
    const streamingComponent = new AssistantMessageComponent();
    state.streamingComponent = streamingComponent;
    state.chatContainer.addChild(streamingComponent);

    addUserMessage(
      state,
      createReminderMessage({
        type: 'system_reminder',
        reminderType: 'goal',
        message: 'Finish the implementation.',
        goalMaxTurns: 20,
        judgeModelId: 'openai/gpt-5.5',
      } as Extract<AgentControllerMessage['content'][number], { type: 'system_reminder' }>),
    );

    expect(state.chatContainer.children).toHaveLength(2);
    expect(state.chatContainer.children[0]).toBe(state.allSystemReminderComponents[0]);
    expect(state.chatContainer.children[1]).toBe(streamingComponent);
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

  it('keeps pending signals pinned below streamed history', () => {
    const state = createState();

    addPendingUserMessage(state, 'pending-signal-1', 'pending');
    addUserMessage(state, createUserMessage('streamed before pending', 'user-2'));

    expect(state.pendingSignalMessageComponentsById.has('pending-signal-1')).toBe(true);
    expect(state.messageComponentsById.has('user-2')).toBe(true);
    expect(state.chatContainer.children).toHaveLength(3);
    expect(state.chatContainer.children[0]).toBe(state.messageComponentsById.get('user-2'));
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(state.chatContainer.children[2]).toBe(
      state.pendingSignalMessageComponentsById.get('pending-signal-1')?.component,
    );
  });

  it('uses the same spacing for pending and confirmed user messages', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('first', 'user-1'));
    addPendingUserMessage(state, 'pending-signal-1', 'continue with this');

    expect(state.chatContainer.children).toHaveLength(3);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);

    addUserMessage(state, createUserMessage('continue with this', 'pending-signal-1'));

    expect(state.chatContainer.children).toHaveLength(3);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(state.chatContainer.children[2]).toBeInstanceOf(UserMessageComponent);
  });

  it('renders while-active user messages with the steer label from message attributes', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('continue with this', 'signal-1', { delivery: 'while-active' }));

    const rendered = (state.chatContainer.children[0] as UserMessageComponent)
      .render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('╭ steer ');
  });

  it('confirms pending active signals with the steer label', () => {
    const state = createState();

    addPendingUserMessage(state, 'pending-signal-1', 'continue with this', undefined, { isInterjection: true });
    addUserMessage(state, createUserMessage('continue with this', 'pending-signal-1'));

    const rendered = (state.chatContainer.children[0] as UserMessageComponent)
      .render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('╭ steer ');
  });

  it('replaces a pending signal with the echoed user message once the stream is settled', () => {
    const state = createState();

    addPendingUserMessage(state, 'pending-signal-1', 'continue with this');
    const pending = state.chatContainer.children[0];

    addUserMessage(state, createUserMessage('continue with this', 'pending-signal-1'));

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(UserMessageComponent);
    expect(state.chatContainer.children[0]).not.toBe(pending);
    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.followUpComponents).toEqual([]);
    expect(state.messageComponentsById.get('pending-signal-1')).toBe(state.chatContainer.children[0]);
  });

  it('ignores echoed idle signals that were already rendered directly', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('render directly', 'signal-idle-1'));
    const rendered = state.chatContainer.children[0];

    addUserMessage(state, createUserMessage('render directly', 'signal-idle-1'));

    expect(state.chatContainer.children).toEqual([rendered]);
    expect(state.messageComponentsById.get('signal-idle-1')).toBe(rendered);
  });
});

describe('renderExistingMessages signals', () => {
  it('reconstructs persisted active signal messages without resurrecting pending previews', async () => {
    const state = createState();
    addPendingUserMessage(state, 'stale-signal', 'stale preview', undefined, { isInterjection: true });

    state.session = {
      ...state.session,
      thread: {
        listActiveMessages: vi
          .fn()
          .mockResolvedValue([
            createUserMessage('continue from history', 'signal-history-1', { delivery: 'while-active' }),
          ]),
      },
    } as unknown as TUIState['session'];
    state.controller = {
      session: {
        displayState: { get: () => ({ isRunning: false }) },
      },
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('signal-history-1')).toBe(state.chatContainer.children[0]);

    const rendered = (state.chatContainer.children[0] as UserMessageComponent)
      .render(80)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('╭ steer ');
    expect(rendered).toContain('continue from history');
    expect(rendered).not.toContain('stale preview');
  });
});

describe('renderExistingMessages tasks', () => {
  it('renders persisted task additions and crossed-off tasks inline', async () => {
    const initialTasks = [
      {
        id: 'history-task-1',
        content: 'Loaded history task one',
        status: 'pending',
        activeForm: 'Loading history task one',
      },
    ];
    const updatedTasks = [
      { ...initialTasks[0], status: 'completed' },
      {
        id: 'history-task-2',
        content: 'Loaded history task two',
        status: 'in_progress',
        activeForm: 'Loading history task two',
      },
      {
        id: 'history-task-3',
        content: 'Loaded history task three',
        status: 'pending',
        activeForm: 'Loading history task three',
      },
    ];
    const message: AgentControllerMessage = {
      id: 'assistant-task-delta-history',
      role: 'assistant',
      createdAt: new Date(),
      content: [
        { type: 'tool_call', id: 'task-write-1', name: 'task_write', args: { tasks: initialTasks } },
        {
          type: 'tool_result',
          id: 'task-write-1',
          name: 'task_write',
          result: { tasks: initialTasks },
          isError: false,
        },
        { type: 'tool_call', id: 'task-complete-1', name: 'task_complete', args: { id: 'history-task-1' } },
        {
          type: 'tool_result',
          id: 'task-complete-1',
          name: 'task_complete',
          result: { tasks: updatedTasks },
          isError: false,
        },
      ],
    } as unknown as AgentControllerMessage;
    const state = createState();
    state.session = {
      ...state.session,
      thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
    } as unknown as TUIState['session'];

    await renderExistingMessages(state);

    const rendered = state.chatContainer
      .render(100)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('Tasks');
    expect(rendered).toContain('○ Loaded history task one');
    expect(rendered).toContain('▶ Loading history task two');
    expect(rendered).toContain('○ Loaded history task three');
    expect(rendered).toContain('✓ Loaded history task one');
  });

  it('renders completed persisted task_write history inline', async () => {
    const tasks = [
      {
        id: 'history-task-1',
        content: 'Loaded history task one',
        status: 'completed',
        activeForm: 'Loading history task one',
      },
      {
        id: 'history-task-2',
        content: 'Loaded history task two',
        status: 'completed',
        activeForm: 'Loading history task two',
      },
    ];
    const message: AgentControllerMessage = {
      id: 'assistant-task-history',
      role: 'assistant',
      createdAt: new Date(),
      content: [
        { type: 'tool_call', id: 'task-write-1', name: 'task_write', args: { tasks } },
        { type: 'tool_result', id: 'task-write-1', name: 'task_write', result: { tasks }, isError: false },
      ],
    } as unknown as AgentControllerMessage;
    const state = createState();
    state.session = {
      ...state.session,
      thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
    } as unknown as TUIState['session'];

    await renderExistingMessages(state);

    const rendered = state.chatContainer
      .render(100)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('Tasks [2/2 completed]');
    expect(rendered).toContain('Loaded history task one');
    expect(rendered).toContain('Loaded history task two');
  });
});

describe('renderExistingMessages subagents', () => {
  it('uses static plugin renderer config when replaying persisted plugin tool calls', async () => {
    const message: AgentControllerMessage = {
      id: 'assistant-plugin-renderer',
      role: 'assistant',
      createdAt: new Date(),
      content: [
        {
          type: 'tool_call',
          id: 'tool-1',
          name: 'mastra_expert',
          args: { question: 'How does memory rendering work?' },
        },
        {
          type: 'tool_result',
          id: 'tool-1',
          name: 'mastra_expert',
          result: 'remembered answer',
          isError: false,
        },
      ],
    } as unknown as AgentControllerMessage;
    const state = createState();
    state.quietMode = true;
    state.pluginManager = {
      getToolRenderConfig: vi.fn(() => ({ type: 'subagent', agentType: 'alexandria', modelId: 'openai/gpt-5.5' })),
    } as unknown as TUIState['pluginManager'];
    state.session = {
      ...state.session,
      thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
    } as unknown as TUIState['session'];
    state.controller = {
      session: state.session,
    } as unknown as TUIState['controller'];

    await renderExistingMessages(state);

    expect(state.pluginManager?.getToolRenderConfig).toHaveBeenCalledWith('mastra_expert');
    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(SubagentExecutionComponent);
    const rendered = (state.chatContainer.children[0] as SubagentExecutionComponent)
      .render(100)
      .join('\n')
      .replace(/\x1b\[[0-9;]*m/g, '');
    expect(rendered).toContain('alexandria openai/gpt-5.5');
    expect(rendered).toContain('How does memory rendering work?');
    expect(rendered).toContain('remembered answer');
  });

  it('uses the current model id for persisted forked subagents when no metadata tag is present', async () => {
    const message: AgentControllerMessage = {
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
    state.quietMode = true;
    state.session = {
      ...state.session,
      thread: { listActiveMessages: vi.fn().mockResolvedValue([message]) },
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
    expect(rendered).toContain('summary text');
  });
});
