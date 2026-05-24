/**
 * Harness v1 — public-view projection tests.
 *
 *   - default redaction policy strips payload fields per event shape
 *   - lifecycle / progress events pass through unchanged
 *   - assistant message deltas are preserved (UX-critical)
 *   - custom event payloads are redacted; `opts.redactor` can opt back in
 *   - `opts.redactor` can drop an event (return null) from the public stream
 *   - input is never mutated
 */

import { describe, expect, it } from 'vitest';

import type { HarnessEvent } from './events';
import { HARNESS_PUBLIC_VIEW_REDACTED, projectHarnessEventForPublicView } from './public-view';

const baseEvent = {
  id: 'harness-v1:test:1',
  timestamp: 1,
  sessionId: 's1',
};

describe('projectHarnessEventForPublicView — default policy', () => {
  it('redacts tool_start.args', () => {
    const event = {
      ...baseEvent,
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'write_file',
      args: { path: '/secrets/key.pem', content: 'PRIVATE-KEY' },
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect(out).toMatchObject({ type: 'tool_start', toolCallId: 'tc1', toolName: 'write_file' });
    expect((out as any).args).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts tool_end.result but preserves isError + toolCallId', () => {
    const event = {
      ...baseEvent,
      type: 'tool_end',
      toolCallId: 'tc1',
      result: { secret: 'shh' },
      isError: false,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect(out).toMatchObject({ type: 'tool_end', toolCallId: 'tc1', isError: false });
    expect((out as any).result).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts tool_update.partialResult', () => {
    const event = {
      ...baseEvent,
      type: 'tool_update',
      toolCallId: 'tc1',
      partialResult: { credentials: { token: 'xxx' } },
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).partialResult).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts shell_output.output, preserves stream + toolCallId', () => {
    const event = {
      ...baseEvent,
      type: 'shell_output',
      toolCallId: 'tc1',
      stream: 'stdout',
      output: 'AWS_SECRET_KEY=abc123',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect(out).toMatchObject({ type: 'shell_output', toolCallId: 'tc1', stream: 'stdout' });
    expect((out as any).output).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts subagent_tool_start.args (when present)', () => {
    const event = {
      ...baseEvent,
      type: 'subagent_tool_start',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      innerToolCallId: 'inner1',
      toolName: 'lookup',
      args: { query: 'company secrets' },
      depth: 1,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).args).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('subagent_tool_start without args is unchanged', () => {
    const event = {
      ...baseEvent,
      type: 'subagent_tool_start',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      innerToolCallId: 'inner1',
      toolName: 'lookup',
      depth: 1,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect(out).toEqual(event);
  });

  it('redacts subagent_tool_end.output and subagent_end.output', () => {
    const toolEnd = {
      ...baseEvent,
      type: 'subagent_tool_end',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      innerToolCallId: 'inner1',
      toolName: 'lookup',
      output: { rows: 'sensitive' },
      isError: false,
      depth: 1,
    } as unknown as HarnessEvent;
    const subEnd = {
      ...baseEvent,
      type: 'subagent_end',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      output: { summary: 'private' },
      isError: false,
      durationMs: 10,
      depth: 1,
    } as unknown as HarnessEvent;
    expect((projectHarnessEventForPublicView(toolEnd)! as any).output).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((projectHarnessEventForPublicView(subEnd)! as any).output).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts custom event payloads', () => {
    const event = {
      ...baseEvent,
      type: 'app.progress',
      payload: { ratio: 0.5, internal: 'secret' },
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).payload).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('passes lifecycle events through unchanged (value-equal, not reference-equal)', () => {
    for (const type of [
      'session_created',
      'session_closing',
      'session_closed',
      'session_deleted',
      'session_evicted',
      'agent_start',
      'agent_end',
      'mode_changed',
      'goal_resumed',
      'goal_paused',
      'goal_cleared',
    ]) {
      const event = { ...baseEvent, type } as unknown as HarnessEvent;
      const out = projectHarnessEventForPublicView(event)!;
      expect(out).toEqual(event);
      // Purity contract: the returned object must NOT be the same
      // reference as the input. A downstream mutation must not reach
      // the caller's event.
      expect(out).not.toBe(event);
    }
  });

  it('redacts tool_input_delta.argsTextDelta (model streams tool args here before tool_start)', () => {
    const event = {
      ...baseEvent,
      type: 'tool_input_delta',
      toolCallId: 'tc1',
      toolName: 'write_file',
      argsTextDelta: '"content": "PRIVATE-KEY"',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).argsTextDelta).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts subagent_start.task (the prompt routed into the subagent)', () => {
    const event = {
      ...baseEvent,
      type: 'subagent_start',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      task: 'Review the production credentials file',
      modelId: 'fake',
      depth: 1,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).task).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts subagent_text_delta.delta', () => {
    const event = {
      ...baseEvent,
      type: 'subagent_text_delta',
      toolCallId: 'tc1',
      subagentSessionId: 'sub1',
      agentType: 'explore',
      delta: 'I found the secret value...',
      depth: 1,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).delta).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts om_observation_end and om_reflection_end free-form text fields', () => {
    const obs = {
      ...baseEvent,
      type: 'om_observation_end',
      cycleId: 'c1',
      durationMs: 1,
      tokensObserved: 1,
      observationTokens: 1,
      observations: 'private observation text',
      currentTask: 'unfinished work',
      suggestedResponse: 'tell user about secret',
    } as unknown as HarnessEvent;
    const ref = {
      ...baseEvent,
      type: 'om_reflection_end',
      cycleId: 'c1',
      durationMs: 1,
      compressedTokens: 1,
      observations: 'private reflection text',
    } as unknown as HarnessEvent;
    const obsOut = projectHarnessEventForPublicView(obs)!;
    const refOut = projectHarnessEventForPublicView(ref)!;
    expect((obsOut as any).observations).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((obsOut as any).currentTask).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((obsOut as any).suggestedResponse).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((refOut as any).observations).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts thread_settings_changed.patch + removedKeys (arbitrary user keys)', () => {
    const event = {
      ...baseEvent,
      type: 'thread_settings_changed',
      threadId: 't1',
      resourceId: 'u1',
      patch: { apiKey: 'shh' },
      removedKeys: ['internalSchema', 'flag'],
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).patch).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((out as any).removedKeys).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts state_changed.changedKeys', () => {
    const event = {
      ...baseEvent,
      type: 'state_changed',
      changedKeys: ['customer.id', 'internal.flag'],
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).changedKeys).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts goal_set.goal and goal_judged.decision', () => {
    const set = {
      ...baseEvent,
      type: 'goal_set',
      goal: { id: 'g1', text: 'private goal' },
    } as unknown as HarnessEvent;
    const judged = {
      ...baseEvent,
      type: 'goal_judged',
      goalId: 'g1',
      decision: { verdict: 'continue', reason: 'private reasoning' },
      turnsUsed: 1,
      maxTurns: 5,
    } as unknown as HarnessEvent;
    expect((projectHarnessEventForPublicView(set)! as any).goal).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((projectHarnessEventForPublicView(judged)! as any).decision).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts om_observation_failed / om_reflection_failed / om_buffering_failed error fields', () => {
    for (const type of ['om_observation_failed', 'om_reflection_failed', 'om_buffering_failed']) {
      const event = { ...baseEvent, type, error: 'stack trace with paths' } as unknown as HarnessEvent;
      const out = projectHarnessEventForPublicView(event)!;
      expect((out as any).error).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    }
  });

  it('redacts om_buffering_end.observations when present', () => {
    const event = {
      ...baseEvent,
      type: 'om_buffering_end',
      cycleId: 'c1',
      operationType: 'observation',
      tokensBuffered: 1,
      bufferedTokens: 1,
      observations: 'private buffered text',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).observations).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts om_thread_title_updated old + new titles', () => {
    const event = {
      ...baseEvent,
      type: 'om_thread_title_updated',
      cycleId: 'c1',
      threadId: 't1',
      oldTitle: 'Sensitive Title',
      newTitle: 'Even More Sensitive Title',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).oldTitle).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((out as any).newTitle).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts thread_created / thread_renamed / thread_cloned titles', () => {
    const created = {
      ...baseEvent,
      type: 'thread_created',
      threadId: 't1',
      resourceId: 'u1',
      title: 'Customer Records Q4',
    } as unknown as HarnessEvent;
    const renamed = {
      ...baseEvent,
      type: 'thread_renamed',
      threadId: 't1',
      resourceId: 'u1',
      title: 'Customer Records Q4',
      previousTitle: 'Old Title',
    } as unknown as HarnessEvent;
    const cloned = {
      ...baseEvent,
      type: 'thread_cloned',
      threadId: 't2',
      resourceId: 'u1',
      sourceThreadId: 't1',
      title: 'Customer Records Q4 — Copy',
    } as unknown as HarnessEvent;
    expect((projectHarnessEventForPublicView(created)! as any).title).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    const rOut = projectHarnessEventForPublicView(renamed)! as any;
    expect(rOut.title).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect(rOut.previousTitle).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((projectHarnessEventForPublicView(cloned)! as any).title).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts goal_done.reason', () => {
    const event = {
      ...baseEvent,
      type: 'goal_done',
      goalId: 'g1',
      reason: 'verdict text from model',
      turnsUsed: 3,
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).reason).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((out as any).goalId).toBe('g1');
    expect((out as any).turnsUsed).toBe(3);
  });

  it('redacts workspace_error.error.message but preserves error.name', () => {
    const event = {
      ...baseEvent,
      type: 'workspace_error',
      error: { name: 'HarnessWorkspaceLostError', message: '/abs/path/to/secrets.json missing' },
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).error.name).toBe('HarnessWorkspaceLostError');
    expect((out as any).error.message).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
  });

  it('redacts task_updated tasks[].content and activeForm', () => {
    const event = {
      ...baseEvent,
      type: 'task_updated',
      tasks: [
        { id: '1', content: 'Roll out customer secret', activeForm: 'Rolling out secret' },
        { id: '2', content: 'Other work' },
      ],
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect((out as any).tasks[0].content).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((out as any).tasks[0].activeForm).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    expect((out as any).tasks[1].content).toBe(HARNESS_PUBLIC_VIEW_REDACTED);
    // id passes through; activeForm absent → still absent.
    expect((out as any).tasks[0].id).toBe('1');
    expect((out as any).tasks[1]).not.toHaveProperty('activeForm');
  });

  it('preserves assistant message deltas (UX-critical streaming text)', () => {
    const event = {
      ...baseEvent,
      type: 'message_update',
      messageId: 'm1',
      delta: 'Hello, world!',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event)!;
    expect(out).toEqual(event);
  });
});

describe('projectHarnessEventForPublicView — customization', () => {
  it('redactor runs after default; can allowlist a tool by un-redacting', () => {
    const event = {
      ...baseEvent,
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'list_files',
      args: { dir: '.' },
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event, {
      redactor: e => {
        if (e.type === 'tool_start' && (e as any).toolName === 'list_files') {
          return { ...e, args: { dir: '.' } } as HarnessEvent;
        }
        return e;
      },
    })!;
    expect((out as any).args).toEqual({ dir: '.' });
  });

  it('redactor can drop an event entirely by returning null', () => {
    const event = {
      ...baseEvent,
      type: 'om_observation_start',
    } as unknown as HarnessEvent;
    const out = projectHarnessEventForPublicView(event, {
      redactor: e => (e.type.startsWith('om_') ? null : e),
    });
    expect(out).toBeNull();
  });

  it('does not mutate the input event', () => {
    const event = {
      ...baseEvent,
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'write_file',
      args: { content: 'plaintext' },
    } as unknown as HarnessEvent;
    const before = JSON.parse(JSON.stringify(event));
    projectHarnessEventForPublicView(event);
    expect(event).toEqual(before);
  });
});
