import { describe, expect, it } from 'vitest';

import { PLANS } from './cast';
import { backgroundRows, boardBilling, factoryConversations, personalConversations } from './modelRouting';
import type { FlowRow } from './modelRouting';
import { BASE_STATE } from './storyState';
import type { StoryState } from './storyState';

function state(change: Partial<StoryState>): StoryState {
  return { ...BASE_STATE, ...change };
}

function row(rows: FlowRow[], id: string): FlowRow {
  const found = rows.find(candidate => candidate.id === id);
  if (!found) throw new Error(`No row ${id}`);
  return found;
}

describe('model routing tells what runs where and who pays', () => {
  it('leaves board cards and auto-start waiting without a Factory account', () => {
    const next = state({ sharedAccount: null, autoRun: true });
    expect(boardBilling(next)).toEqual({ kind: 'missing' });
    expect(row(backgroundRows(next), 'auto')).toMatchObject({ status: 'waiting', payer: 'factory' });
  });

  it('bills board cards to each owner and flags members without a plan', () => {
    const billing = boardBilling(state({ factoryWorkRunsOn: 'owner' }));
    expect(billing.kind === 'owners' && billing.members).toContainEqual({
      persona: 'grayson',
      name: 'Grayson',
      detail: 'no plan · waits',
      ok: false,
    });
  });

  it('routes Slack by the org setting and blocks it while memory fails', () => {
    expect(row(factoryConversations(BASE_STATE), 'slack-dm')).toMatchObject({ payer: 'members', status: 'ready' });
    expect(row(factoryConversations(BASE_STATE), 'slack-channel')).toMatchObject({ payer: 'factory' });
    const broken = state({ memory: { model: 'Haiku 4.5', broken: true } });
    expect(row(factoryConversations(broken), 'slack-channel')).toMatchObject({
      status: 'blocked',
      model: 'Memory model Haiku 4.5 failing',
    });
  });

  it('pauses my sessions on a disconnected plan and sends my DMs to Factory when personal sessions are off', () => {
    const memberPlans = { ...BASE_STATE.memberPlans, shane: { ...PLANS.claudeMax, disconnected: true } };
    expect(row(personalConversations(state({ memberPlans })), 'sessions')).toMatchObject({
      status: 'blocked',
      payer: 'mine',
      model: 'Reconnect Claude Max',
    });
    const off = personalConversations(state({ personalSessions: false }));
    expect(row(off, 'sessions')).toMatchObject({ status: 'off', payer: null });
    expect(row(off, 'slack-dm')).toMatchObject({ payer: 'factory', status: 'ready' });
  });
});
