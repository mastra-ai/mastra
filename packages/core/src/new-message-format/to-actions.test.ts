import { describe, expect, it } from 'vitest';
import { createSignal } from '../agent/signals';
import { toActions } from './to-actions';

describe('toActions', () => {
  it('string → user text', () => {
    expect(toActions('hi')).toEqual({ system: [], actions: [{ type: 'text', role: 'user', text: 'hi' }] });
  });

  it('system messages become instructions, not actions', () => {
    const r = toActions([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'hi' },
    ]);
    expect(r.system).toEqual(['be terse']);
    expect(r.actions).toEqual([{ type: 'text', role: 'user', text: 'hi' }]);
  });

  it('v4 CoreMessage tool round trip (args/result)', () => {
    const r = toActions([
      { role: 'user', content: [{ type: 'image', image: new Uint8Array([1, 2]), mimeType: 'image/png' }] },
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'c1', toolName: 'w', args: { a: 1 } }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c1', toolName: 'w', result: { ok: 1 } }] },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'c2', toolName: 'w', result: 'boom', isError: true }],
      },
    ]);
    expect(r.actions).toEqual([
      { type: 'file', role: 'user', mediaType: 'image/png', data: 'AQI=' },
      { type: 'tool-call', role: 'assistant', toolCallId: 'c1', toolName: 'w', input: { a: 1 } },
      { type: 'tool-result', toolCallId: 'c1', toolName: 'w', output: { ok: 1 } },
      { type: 'tool-error', toolCallId: 'c2', toolName: 'w', errorText: 'boom' },
    ]);
  });

  it('v5–v7 ModelMessage: reasoning, tool outputs, approvals', () => {
    const r = toActions([
      { role: 'user', content: [{ type: 'file', data: new URL('https://x/y.pdf'), mediaType: 'application/pdf' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'think', providerOptions: { openai: { itemId: 'rs_1' } } },
          { type: 'text', text: 'calling' },
          { type: 'tool-call', toolCallId: 'c1', toolName: 'w', input: { city: 'SF' } },
          { type: 'tool-approval-request', approvalId: 'a1', toolCallId: 'c1' },
        ],
      },
      {
        role: 'tool',
        content: [
          { type: 'tool-approval-response', approvalId: 'a1', approved: true },
          { type: 'tool-result', toolCallId: 'c1', toolName: 'w', output: { type: 'json', value: { t: 21 } } },
          { type: 'tool-result', toolCallId: 'c2', toolName: 'w', output: { type: 'error-text', value: 'bad' } },
          {
            type: 'tool-result',
            toolCallId: 'c3',
            toolName: 'w',
            output: { type: 'execution-denied', reason: 'no' },
          },
        ],
      },
    ]);
    expect(r.actions.map(a => a.type)).toEqual([
      'file',
      'reasoning',
      'text',
      'tool-call',
      'tool-approval-requested',
      'tool-approval-responded',
      'tool-result',
      'tool-error',
      'tool-denied',
    ]);
    expect(r.actions[0]).toMatchObject({ data: 'https://x/y.pdf' });
    expect(r.actions[4]).toMatchObject({ toolCallId: 'c1', toolName: 'w' });
    expect(r.actions[5]).toMatchObject({ toolCallId: 'c1', toolName: 'w', approved: true });
    expect(r.actions[1]).toMatchObject({ providerMetadata: { openai: { itemId: 'rs_1' } } });
    expect(r.actions[6]).toMatchObject({ output: { t: 21 } });
    expect(r.actions[8]).toMatchObject({ reason: 'no' });
  });

  it('v5+ UIMessage parts incl. tool states and approvals', () => {
    const r = toActions([
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'weather?' }] },
      {
        id: 'a1',
        role: 'assistant',
        parts: [
          { type: 'step-start' },
          { type: 'tool-weather', toolCallId: 'c1', state: 'output-available', input: { c: 'SF' }, output: 21 },
          { type: 'dynamic-tool', toolName: 'dyn', toolCallId: 'c2', state: 'output-error', input: {}, errorText: 'x' },
          {
            type: 'tool-weather',
            toolCallId: 'c3',
            state: 'output-denied',
            input: {},
            approval: { id: 'ap', approved: false, reason: 'nope' },
          },
          { type: 'tool-weather', toolCallId: 'c4', state: 'input-streaming' },
          { type: 'source-url', sourceId: 's', url: 'https://s' },
          { type: 'data-chart', data: { n: 1 } },
          { type: 'text', text: 'done' },
        ],
      },
    ]);
    expect(r.actions.map(a => a.type)).toEqual([
      'text',
      'tool-call',
      'tool-result',
      'tool-call',
      'tool-error',
      'tool-call',
      'tool-approval-requested',
      'tool-approval-responded',
      'tool-denied',
      'source-url',
      'data-chart',
      'text',
    ]);
    expect(r.actions[1]).toMatchObject({ toolName: 'weather', input: { c: 'SF' } });
    expect(r.actions[3]).toMatchObject({ toolName: 'dyn' });
    expect(r.actions[8]).toMatchObject({ reason: 'nope' });
  });

  it('v4 UIMessage toolInvocations', () => {
    const r = toActions({
      role: 'assistant',
      content: 'ok',
      toolInvocations: [{ state: 'result', toolCallId: 'c', toolName: 't', args: {}, result: 1 }],
    });
    expect(r.actions.map(a => a.type)).toEqual(['text', 'tool-call', 'tool-result']);
  });

  it('rejects unknown parts', () => {
    expect(() => toActions({ role: 'user', content: [{ type: 'nope' }] })).toThrow(/nope/);
  });

  it('created signals → signal actions, mixed with strings', () => {
    const signal = createSignal({
      type: 'notification',
      tagName: 'ci',
      contents: 'build failed',
      attributes: { job: 'lint' },
    });
    expect(toActions(['hi', signal]).actions).toEqual([
      { type: 'text', role: 'user', text: 'hi' },
      {
        type: 'signal',
        category: 'notification',
        tagName: 'ci',
        contents: [{ type: 'text', text: 'build failed' }],
        attributes: { job: 'lint' },
      },
    ]);
    expect(() => toActions(createSignal({ type: 'notification', contents: 'x', transient: true }))).toThrow(
      /Transient/,
    );
  });
});
