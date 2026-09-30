import type { Actor, PersonaId } from './cast';
import { actorName } from './cast';
import type { StoryScope } from './storyScopePaths';
import { scopedSectionPath } from './storyScopePaths';
import type { BlockedReason } from './storyState';

export type SettingsAnchor = 'factory-work' | 'personal-sessions' | 'slack' | 'memory' | 'my-plan';

export const SETTINGS_ANCHOR_TITLES: Record<SettingsAnchor, string> = {
  'factory-work': 'Factory work',
  'personal-sessions': 'Personal sessions',
  slack: 'Slack',
  memory: 'Memory model',
  'my-plan': 'My plan',
};

export function settingsAnchorId(anchor: SettingsAnchor): string {
  return `story-${anchor}`;
}

const ANCHOR_SCOPES: Record<SettingsAnchor, StoryScope> = {
  'factory-work': 'factory',
  'personal-sessions': 'factory',
  slack: 'factory',
  memory: 'factory',
  'my-plan': 'personal',
};

export function storySettingsPath(factoryId: string, anchor: SettingsAnchor): string {
  return `${scopedSectionPath(factoryId, 'models', ANCHOR_SCOPES[anchor])}#${settingsAnchorId(anchor)}`;
}

export function ruleAnchorId(ruleId: string): string {
  return `rule-${ruleId}`;
}

export function storyRulePath(factoryId: string, ruleId?: string): string {
  const rules = `/factories/${factoryId}/rules`;
  return ruleId ? `${rules}#${ruleAnchorId(ruleId)}` : rules;
}

export const NEW_WORKFLOW_ANCHOR = 'new-workflow';

export function workflowAnchorId(workflowId: string): string {
  return `workflow-${workflowId}`;
}

export function storyWorkflowPath(factoryId: string, workflowId?: string): string {
  return `/factories/${factoryId}/rules#${workflowId ? workflowAnchorId(workflowId) : NEW_WORKFLOW_ANCHOR}`;
}

export type StoryFix = { label: string; anchor: SettingsAnchor };

export function blockedFix(reason: BlockedReason, payer: Actor, viewer: PersonaId): StoryFix {
  const payersOwn = payer === viewer;
  switch (reason) {
    case 'shared-account':
      return { label: 'Connect the Factory account', anchor: 'factory-work' };
    case 'member-plan':
      return payersOwn
        ? { label: 'Connect your plan', anchor: 'my-plan' }
        : { label: `${actorName(payer)} has no plan`, anchor: 'factory-work' };
    case 'reconnect':
      return payersOwn
        ? { label: 'Reconnect your plan', anchor: 'my-plan' }
        : { label: `${actorName(payer)} must reconnect`, anchor: 'factory-work' };
    case 'restricted':
      return { label: 'See allowed connections', anchor: 'personal-sessions' };
    case 'memory':
      return { label: 'Fix the memory model', anchor: 'memory' };
  }
}
