import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { AgentConnectionRegistry } from '../registry.js';
import { createAgentConnectionTools } from '../tools.js';

// A sender's model copied a saved peer's id with one hex digit changed (9c10 -> 7c10) and kept resending it,
// because the refusal never said which saved peer it most likely meant.
const RESOURCE_ID = 'team-resource';
const REVIEWER = { resourceId: RESOURCE_ID, threadId: 'f4c572af-9c10-4836-a1a5-33c4473f2b33', label: 'reviewer' };
const BUILDER = { resourceId: RESOURCE_ID, threadId: 'eb341602-09cd-499c-94b5-18c5423e1a2d', label: 'builder' };
const LEAD = { resourceId: 'lead-resource', threadId: 'ea02a4ad-83c0-4b0b-8aeb-f3bd0a5c2c7f', label: 'lead' };
const peerId = (peer: { resourceId: string; threadId: string }) => `code-agent:${peer.resourceId}:${peer.threadId}`;
const REVIEWER_ID = peerId(REVIEWER);
const BUILDER_ID = peerId(BUILDER);
const LEAD_ID = peerId(LEAD);
const MISTYPED_REVIEWER_ID = `code-agent:${RESOURCE_ID}:f4c572af-7c10-4836-a1a5-33c4473f2b33`;

async function setup(advertised = [REVIEWER, BUILDER, LEAD]) {
  const storage = new InMemoryStore();
  const sendNotificationSignal = vi.fn(async () => ({
    record: { id: 'notification-1' },
    decision: { action: 'deliver' as const },
    accepted: Promise.resolve({ action: 'deliver' as const, runId: 'run-1' }),
  }));
  const tools = createAgentConnectionTools({
    registry: new AgentConnectionRegistry({ now: () => 1_000, listPeers: () => advertised }),
    getAgent: () => ({ sendNotificationSignal }),
  });
  const context = {
    agent: { resourceId: RESOURCE_ID, threadId: '9077dc78-1829-4dd3-b1e6-c38f08662da8' },
    mastra: { getStorage: () => storage },
  } as any;
  const connected = await (tools.agent_connect as any).execute({ ids: advertised.map(peerId) }, context);
  expect(connected).toMatchObject({ isError: false });
  const input = { message: 'Your report is superseded.', priority: 'high', expectsReply: false };
  const send = (targetId: string) => (tools.agent_signal_send as any).execute({ ...input, targetId }, context);
  const connect = (ids: string[]) => (tools.agent_connect as any).execute({ ids }, context);
  return { send, connect, sendNotificationSignal };
}

describe('refusing a peer id that is not saved', () => {
  it('names the saved peer a mistyped id most likely meant and sends nothing until an exact resend', async () => {
    const { send, sendNotificationSignal } = await setup();

    const refused = await send(MISTYPED_REVIEWER_ID);

    expect(refused.isError).toBe(true);
    expect(refused.content.startsWith(`Cannot send: no saved peer has id ${MISTYPED_REVIEWER_ID}.`)).toBe(true);
    expect(refused.content).toContain(`Did you mean ${REVIEWER_ID} ("reviewer")?`);
    expect(refused.content).not.toContain(BUILDER_ID);
    expect(refused.content).not.toContain(LEAD_ID);
    expect(sendNotificationSignal).not.toHaveBeenCalled();

    const resent = await send(REVIEWER_ID);
    expect(resent).toMatchObject({ isError: false, routingAction: 'deliver' });
    expect(sendNotificationSignal).toHaveBeenCalledTimes(1);
  });

  it('names the same peer when agent_connect gets the mistyped id', async () => {
    const { connect } = await setup();

    const refused = await connect([MISTYPED_REVIEWER_ID]);

    expect(refused.isError).toBe(true);
    expect(refused.content.startsWith(`Unknown or unadvertised agent peer id: ${MISTYPED_REVIEWER_ID}.`)).toBe(true);
    expect(refused.content).toContain(`Did you mean ${REVIEWER_ID} ("reviewer")?`);
  });

  it('names the saved peer whose label was sent in place of its id', async () => {
    const { send, sendNotificationSignal } = await setup();

    const refused = await send('reviewer');

    expect(refused.isError).toBe(true);
    expect(refused.content).toContain(`Did you mean ${REVIEWER_ID} ("reviewer")?`);
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('names the saved peer whose id had a stretch of another saved peer id spliced into it', async () => {
    // The sender's model copied the reviewer's id but took the middle groups from the builder's id
    // (9c10-4836-a1a5 -> 09cd-499c-94b5). That is 9 edits from the reviewer and 17 from the builder.
    const { send, sendNotificationSignal } = await setup();
    const splicedId = `code-agent:${RESOURCE_ID}:f4c572af-09cd-499c-94b5-33c4473f2b33`;

    const refused = await send(splicedId);

    expect(refused.isError).toBe(true);
    expect(refused.content.startsWith(`Cannot send: no saved peer has id ${splicedId}.`)).toBe(true);
    expect(refused.content).toContain(`Did you mean ${REVIEWER_ID} ("reviewer")?`);
    expect(refused.content).not.toContain(BUILDER_ID);
    expect(refused.content).not.toContain('is not saved');
    expect(sendNotificationSignal).not.toHaveBeenCalled();
  });

  it('matches a label regardless of case and surrounding spaces', async () => {
    const { send } = await setup();

    const refused = await send('  Reviewer ');

    expect(refused.content).toContain(`Did you mean ${REVIEWER_ID} ("reviewer")?`);
  });

  it('keeps the refusal for a saved peer that is not advertised distinct from an unknown id', async () => {
    const advertised = [REVIEWER, BUILDER];
    const { send } = await setup(advertised);
    advertised.length = 0;

    const refused = await send(REVIEWER_ID);

    expect(refused.isError).toBe(true);
    expect(refused.content).toBe(`Cannot send: saved peer is not currently advertised. Peer: ${REVIEWER_ID}`);
  });

  it('suggests nothing for an id that is close to no saved peer', async () => {
    const { send, connect } = await setup();
    const unknownId = `code-agent:${RESOURCE_ID}:00000000-0000-4000-8000-000000000000`;

    await expect(send(unknownId)).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: no saved peer has id ${unknownId}`,
    });
    await expect(connect([unknownId])).resolves.toMatchObject({
      isError: true,
      content: `Unknown or unadvertised agent peer id: ${unknownId}`,
    });
  });

  it('does not suggest a peer with a near thread id in another resource', async () => {
    const { send } = await setup();
    const otherResourceId = `code-agent:other-resource:${REVIEWER.threadId}`;

    await expect(send(otherResourceId)).resolves.toMatchObject({
      isError: true,
      content: `Cannot send: no saved peer has id ${otherResourceId}`,
    });
  });

  it('lists at most three close peers, closest first', async () => {
    // The one-edit peer sorts last by id, so only the distance ordering puts it first and keeps it under the cap.
    const oneEdit = { resourceId: RESOURCE_ID, threadId: 'f4c572af-9c10-4836-a1a5-33c4473f2b33', label: 'one-edit' };
    const twoEdits = ['03', '13', '23'].map(end => ({
      resourceId: RESOURCE_ID,
      threadId: `f4c572af-9c10-4836-a1a5-33c4473f2b${end}`,
      label: `two-edits-${end}`,
    }));
    const { send } = await setup([...twoEdits, oneEdit]);

    const refused = await send(MISTYPED_REVIEWER_ID);

    expect(refused.isError).toBe(true);
    const positions = [oneEdit, ...twoEdits].map(peer => refused.content.indexOf(peerId(peer)));
    const listed = positions.filter(position => position >= 0);
    expect(listed).toHaveLength(3);
    expect(positions[0]).toBeGreaterThanOrEqual(0);
    expect(positions[0]).toBe(Math.min(...listed));
  });
});
