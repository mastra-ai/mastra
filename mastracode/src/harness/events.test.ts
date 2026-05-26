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

  it('projects request_access question suspensions into sandbox access requests', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'sandbox_1_123',
        payload: {
          question: 'Allow Mastra Code to access /outside/project/dir?\n\nneed to read config',
          options: [
            { label: 'Yes', description: 'Grant access for this session.' },
            { label: 'No', description: 'Deny this access request.' },
          ],
          selectionMode: 'single_select',
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'question',
      toolCallId: 'call-1',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'sandbox_access_request',
      questionId: 'sandbox_1_123',
      path: '/outside/project/dir',
      reason: 'need to read config',
    });
  });

  it('projects native sandbox access requests into sandbox access prompts', async () => {
    const { events, projector } = createProjector();

    await projector.project({
      type: 'sandbox_access_requested',
      requestId: 'sandbox-native-1',
      toolCallId: 'sandbox-native-1',
      semanticType: 'file',
      reason: 'needs config',
      payload: { path: '/outside/project/dir' },
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'sandbox_access_request',
      questionId: 'sandbox-native-1',
      path: '/outside/project/dir',
      reason: 'needs config',
      responseKind: 'sandbox-access',
    });
  });

  it('forwards multi-select selectionMode through the generic ask_question projection', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'q-multi',
        payload: {
          question: 'Pick all that apply',
          options: [{ label: 'Alpha' }, { label: 'Beta' }],
          selectionMode: 'multi_select',
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'question',
      toolCallId: 'tool-multi',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'ask_question',
      questionId: 'q-multi',
      question: 'Pick all that apply',
      selectionMode: 'multi_select',
    });
  });

  it('drops unrecognized selectionMode values on the ask_question projection', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'q-bogus',
        payload: {
          question: 'Pick one',
          options: [{ label: 'Alpha' }],
          selectionMode: 'checkboxes',
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'question',
      toolCallId: 'tool-bogus',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'ask_question',
      questionId: 'q-bogus',
      question: 'Pick one',
    });
    expect(events[0]).not.toHaveProperty('selectionMode', 'checkboxes');
    expect((events[0] as { selectionMode?: unknown }).selectionMode).toBeUndefined();
  });

  it('keeps malformed sandbox-like questions on the generic ask_question path', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'sandbox_1_123',
        payload: {
          question: 'Can I do something else?',
          options: [{ label: 'Yes' }],
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'question',
      toolCallId: 'call-1',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'ask_question',
      questionId: 'sandbox_1_123',
      question: 'Can I do something else?',
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

  it('projects tool suspensions into resumable legacy tool events', async () => {
    const { events, projector } = createProjector({
      pending: {
        itemId: 'tool-1',
        toolName: 'long_running_tool',
        payload: {
          input: { id: 1 },
          suspendPayload: { step: 'confirm' },
        },
      },
    });

    await projector.project({
      type: 'suspension_required',
      kind: 'tool-suspension',
      toolCallId: 'tool-1',
      toolName: 'long_running_tool',
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);

    expect(events[0]).toMatchObject({
      type: 'tool_suspended',
      toolCallId: 'tool-1',
      toolName: 'long_running_tool',
      args: { id: 1 },
      suspendPayload: { step: 'confirm' },
    });
  });

  it('projects subagent tool args and stringifies structured subagent output', async () => {
    const { events, projector } = createProjector();

    await projector.project({
      type: 'subagent_tool_start',
      toolCallId: 'parent-tool',
      subagentSessionId: 'child',
      agentType: 'explore',
      innerToolCallId: 'inner-tool',
      toolName: 'read_file',
      args: { path: 'src/index.ts' },
      depth: 1,
      id: 'e1',
      timestamp: 1,
    } as HarnessV1Event);
    await projector.project({
      type: 'subagent_end',
      toolCallId: 'parent-tool',
      subagentSessionId: 'child',
      agentType: 'explore',
      output: { summary: 'done' },
      isError: false,
      durationMs: 12,
      depth: 1,
      id: 'e2',
      timestamp: 2,
    } as HarnessV1Event);

    expect(events.find(event => event.type === 'subagent_tool_start')).toMatchObject({
      subToolCallId: 'inner-tool',
      subToolName: 'read_file',
      subToolArgs: { path: 'src/index.ts' },
    });
    expect(events.find(event => event.type === 'subagent_end')).toMatchObject({
      result: JSON.stringify({ summary: 'done' }),
    });
  });
});
