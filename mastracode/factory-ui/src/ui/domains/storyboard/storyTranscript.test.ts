import { describe, expect, it } from 'vitest';

import { messageAuthor } from '../chat/services/message-author';
import { PLANS } from './cast';
import type { StoryState } from './storyState';
import { BASE_STATE, COMPANY_KEYS_ONLY } from './storyState';
import { sessionRunsOn, storyReplyProvenance, storyTranscript } from './storyTranscript';

function senders(state: StoryState): (string | undefined)[] {
  return storyTranscript(state, 0).flatMap(entry =>
    entry.kind === 'message' && entry.message.role === 'user' ? [messageAuthor(entry.message)?.name] : [],
  );
}

function replyPayers(state: StoryState): string[] {
  return storyTranscript(state, 0).flatMap(entry => {
    if (entry.kind !== 'message' || entry.message.role !== 'assistant') return [];
    const provenance = storyReplyProvenance(state, entry.id);
    return provenance ? [provenance.ranOn.payer] : [];
  });
}

describe('story transcript', () => {
  it("shows the viewer's own messages as theirs and stamps everyone else's", () => {
    expect(senders({ ...BASE_STATE, viewer: 'ward' })).toEqual([undefined, 'Damien', 'Shane', undefined, 'Shane']);
    expect(senders({ ...BASE_STATE, viewer: 'shane' })).toEqual(['Ward', 'Damien', undefined, 'Ward', undefined]);
  });

  it('bills every steering message to the session owner’s plan until someone takes ownership', () => {
    expect(replyPayers(BASE_STATE)).toEqual(['ward', 'ward', 'ward', 'ward', 'shane']);
  });

  it('marks the take ownership with a divider naming the new owner and payer', () => {
    const takeover = storyReplyProvenance(BASE_STATE, 'story-transcript-7')?.switchedTo;
    expect(takeover).toMatchObject({ takenBy: 'shane', to: { payer: 'shane', plan: PLANS.claudeMax } });
  });

  it('falls back to the Factory key when the session owner has no usable plan', () => {
    expect(sessionRunsOn(BASE_STATE, 'grayson')).toMatchObject({ payer: 'factory', plan: BASE_STATE.sharedAccount });
    expect(sessionRunsOn({ ...BASE_STATE, ...COMPANY_KEYS_ONLY }, 'ward')).toMatchObject({ payer: 'factory' });
  });

  it('pauses replies when nobody can bill them', () => {
    const noAccount: StoryState = { ...BASE_STATE, ...COMPANY_KEYS_ONLY, sharedAccount: null, providerKeys: [] };
    expect(sessionRunsOn(noAccount, 'ward')).toBeNull();
    const entries = storyTranscript(noAccount, 0);
    expect(entries.map(entry => entry.kind)).toEqual(['message', 'notice']);
  });

  it('resumes a paused session once someone who can pay takes it over', () => {
    const wardStuck: StoryState = {
      ...BASE_STATE,
      sharedAccount: null,
      providerKeys: [],
      memberPlans: { ...BASE_STATE.memberPlans, ward: null, shane: PLANS.claudeMax },
    };
    const entries = storyTranscript(wardStuck, 0);
    expect(entries.filter(entry => entry.kind === 'notice')).toHaveLength(1);
    expect(entries.at(-1)).toMatchObject({ kind: 'message', message: { role: 'assistant' } });
  });
});
