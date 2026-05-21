import { Container } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { describe, expect, it, vi } from 'vitest';

import { AssistantMessageComponent } from '../components/assistant-message.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { SlashCommandComponent } from '../components/slash-command.js';
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
    harness: {
      getDisplayState: () => ({ isRunning: false }),
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
      } as Extract<HarnessMessage['content'][number], { type: 'system_reminder' }>),
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
      } as Extract<HarnessMessage['content'][number], { type: 'system_reminder' }>),
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
    state.quietMode = true;
    state.harness = {
      listMessages: vi.fn().mockResolvedValue([message]),
      getDisplayState: () => ({ isRunning: false }),
      getFullModelId: () => 'openai/gpt-5.5',
    } as unknown as TUIState['harness'];

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
