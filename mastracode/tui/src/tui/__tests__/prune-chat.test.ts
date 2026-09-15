import { Container, Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { AssistantRenderRegistry } from '../assistant-render-registry.js';
import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { SlashCommandComponent } from '../components/slash-command.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { pruneChatContainer } from '../prune-chat.js';
import type { TUIState } from '../state.js';

function createState(childrenCount: number): TUIState {
  const chatContainer = new Container();

  for (let i = 0; i < childrenCount; i++) {
    chatContainer.addChild(new Text(`child-${i}`, 0, 0));
  }

  return {
    chatContainer,
    assistantRenderRegistry: new AssistantRenderRegistry(),
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    messageComponentsById: new Map(),
    pendingTools: new Map(),
    pendingSubagents: new Map(),
    pendingAskUserComponents: new Map(),
    pendingSubmitPlanComponents: new Map(),
    followUpComponents: [],
    pendingSignalMessageComponentsById: new Map(),
  } as unknown as TUIState;
}

function spacingComponent(label: string): Component {
  const component = new Text(label, 0, 0) as unknown as Component & { getChatSpacingKind(): 'other' };
  component.getChatSpacingKind = () => 'other';
  return component;
}

describe('pruneChatContainer', () => {
  it('does nothing at the exact 500-child threshold', () => {
    const state = createState(500);
    const originalChildren = [...state.chatContainer.children];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toEqual(originalChildren);
  });

  it('keeps approximately 250 children at complete entry boundaries without orphan spacers', () => {
    const state = createState(0);
    for (let index = 0; index < 3001; index++) {
      state.chatContainer.addChild(spacingComponent(`entry-${index}`));
    }
    reconcileChatBoundarySpacers(state.chatContainer);
    expect(state.chatContainer.children).toHaveLength(6001);

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(249);
    expect(isChatBoundarySpacer(state.chatContainer.children[0])).toBe(false);
    expect(isChatBoundarySpacer(state.chatContainer.children.at(-1))).toBe(false);
    expect((state.chatContainer.children[0] as Text).render(80).join('\n')).toContain('entry-2876');
    for (let index = 1; index < state.chatContainer.children.length; index += 2) {
      expect(isChatBoundarySpacer(state.chatContainer.children[index])).toBe(true);
      expect(isChatBoundarySpacer(state.chatContainer.children[index + 1])).toBe(false);
    }
  });

  it('removes every audited direct and wrapped reference while preserving retained identities', () => {
    const state = createState(6000);
    const removed = state.chatContainer.children[10] as Component;
    const retained = state.chatContainer.children[5900] as Component;

    const removedAssistant = new AssistantMessageComponent();
    const retainedAssistant = new AssistantMessageComponent();
    const removedDispose = vi.spyOn(removedAssistant, 'disposeRenderState');
    const retainedDispose = vi.spyOn(retainedAssistant, 'disposeRenderState');
    state.chatContainer.children[20] = removedAssistant;
    state.chatContainer.children[5950] = retainedAssistant;
    state.assistantRenderRegistry.start('removed-message', 'removed-segment', () => removedAssistant);
    state.assistantRenderRegistry.start('retained-message', 'retained-segment', () => retainedAssistant);

    const mapOwners = [
      'messageComponentsById',
      'pendingTools',
      'pendingSubagents',
      'pendingAskUserComponents',
      'pendingSubmitPlanComponents',
    ] as const satisfies ReadonlyArray<keyof TUIState>;
    for (const key of mapOwners) {
      const map = state[key] as Map<string, unknown>;
      map.set('removed', removed);
      map.set('retained', retained);
    }
    state.pendingSignalMessageComponentsById.set('removed', { component: removed, text: 'removed' });
    state.pendingSignalMessageComponentsById.set('retained', { component: retained, text: 'retained' });

    const removedSlash = new SlashCommandComponent('removed', 'echo removed');
    const retainedSlash = new SlashCommandComponent('retained', 'echo retained');
    const removedReminder = new SystemReminderComponent({ message: 'removed' });
    const retainedReminder = new SystemReminderComponent({ message: 'retained' });
    state.chatContainer.children[30] = removedSlash;
    state.chatContainer.children[40] = removedReminder;
    state.chatContainer.children[5800] = retainedSlash;
    state.chatContainer.children[5850] = retainedReminder;

    const arrayOwners = [
      'allToolComponents',
      'allSlashCommandComponents',
      'allSystemReminderComponents',
      'allShellComponents',
      'followUpComponents',
    ] as const satisfies ReadonlyArray<keyof TUIState>;
    for (const key of arrayOwners) {
      state[key] = [removed, retained] as never;
    }
    state.allSlashCommandComponents = [removedSlash, retainedSlash];
    state.allSystemReminderComponents = [removedReminder, retainedReminder];

    const directOwners = [
      'streamingComponent',
      'lastAskUserComponent',
      'activeInlineQuestion',
      'activeInlinePlanApproval',
      'pendingFocus',
      'activeOnboarding',
      'lastSubmitPlanComponent',
      'omProgressComponent',
      'activeOMMarker',
      'activeBufferingMarker',
      'activeActivationMarker',
      'activeActivationProviderChangeMarker',
      'taskProgress',
    ] as const satisfies ReadonlyArray<keyof TUIState>;
    for (const key of directOwners) state[key] = removed as never;
    state.streamingMessage = { id: 'removed-message' } as never;
    state.activeGoalJudge = {
      modelId: 'test',
      abortController: new AbortController(),
      component: removed as never,
    };

    pruneChatContainer(state);

    for (const key of mapOwners) {
      const map = state[key] as Map<string, unknown>;
      expect(map.has('removed'), key).toBe(false);
      expect(map.get('retained'), key).toBe(retained);
    }
    expect(state.pendingSignalMessageComponentsById.has('removed')).toBe(false);
    expect(state.pendingSignalMessageComponentsById.get('retained')?.component).toBe(retained);
    for (const key of arrayOwners) {
      expect(state[key], key).toEqual(
        key === 'allSlashCommandComponents' || key === 'allSystemReminderComponents'
          ? [key === 'allSlashCommandComponents' ? retainedSlash : retainedReminder]
          : [retained],
      );
    }
    for (const key of directOwners) expect(state[key], key).toBeUndefined();
    expect(state.streamingMessage).toBeUndefined();
    expect(state.activeGoalJudge).toBeUndefined();

    expect(removedDispose).toHaveBeenCalledOnce();
    expect(retainedDispose).not.toHaveBeenCalled();
    expect(state.assistantRenderRegistry.get('removed-message')).toBeUndefined();
    expect(state.assistantRenderRegistry.get('retained-message')?.segments.get('retained-segment')?.component).toBe(
      retainedAssistant,
    );
  });

  it('is idempotent after the first prune', () => {
    const state = createState(6000);
    pruneChatContainer(state);
    const retained = [...state.chatContainer.children];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toEqual(retained);
  });
});
