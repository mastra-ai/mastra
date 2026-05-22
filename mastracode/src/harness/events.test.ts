import type { HarnessEvent as HarnessV1Event } from '@mastra/core/harness/v1';
import { describe, expect, it } from 'vitest';

import { MastraCodeHarnessEventProjector } from './events.js';

function createProjector(displayState: Record<string, unknown> = {}) {
  const events: any[] = [];
  const projector = new MastraCodeHarnessEventProjector(
    event => events.push(event),
    () => displayState,
    async (threadId, resourceId) => ({
      id: threadId,
      resourceId,
      title: 'Thread',
      createdAt: new Date(0),
      updatedAt: new Date(0),
    }),
  );
  return { events, projector };
}

describe('MastraCodeHarnessEventProjector', () => {
  it('projects v1 message deltas into legacy full-message updates', async () => {
    const { events, projector } = createProjector();

    await projector.project({ type: 'message_start', messageId: 'm1', id: 'e1', timestamp: 1 } as HarnessV1Event);
    await projector.project({
      type: 'message_update',
      messageId: 'm1',
      delta: 'hel',
      id: 'e2',
      timestamp: 2,
    } as HarnessV1Event);
    await projector.project({
      type: 'message_update',
      messageId: 'm1',
      delta: 'lo',
      id: 'e3',
      timestamp: 3,
    } as HarnessV1Event);

    const updates = events.filter(event => event.type === 'message_update');
    expect(updates.at(-1)?.message.content).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('projects question suspensions into ask_question events', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'q1',
        payload: {
          question: 'Proceed?',
          options: [{ label: 'Yes' }],
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'question',
      toolCallId: 'tool-1',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'ask_question',
      questionId: 'q1',
      question: 'Proceed?',
      options: [{ label: 'Yes' }],
    });
  });

  it('projects plan suspensions into plan approval events', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'p1',
        payload: {
          title: 'Implementation plan',
          plan: '1. Build it',
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'plan-approval',
      toolCallId: 'tool-1',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'plan_approval_required',
      planId: 'p1',
      title: 'Implementation plan',
      plan: '1. Build it',
    });
  });
});
