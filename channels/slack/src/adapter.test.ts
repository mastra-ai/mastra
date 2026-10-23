import { createSlackAdapter as createBaseSlackAdapter } from '@chat-adapter/slack';
import { describe, expect, it, vi } from 'vitest';

import { createSlackAdapter, withAgentSessionTyping } from './adapter';

const THREAD = 'slack:C1:1700.42';

type Call = { method: string; args: Record<string, unknown> };

/**
 * A real `SlackAdapter` whose Web API client is replaced with a recorder, so
 * the tests observe the exact Slack calls Mastra's typing statuses turn into.
 */
function makeBase(config: { agentView?: boolean } = {}) {
  const adapter = createBaseSlackAdapter({
    botToken: 'xoxb-test',
    signingSecret: 'secret',
    userName: 'bot',
    logger: { debug() {}, info() {}, warn() {}, error() {}, child: () => undefined } as any,
    ...config,
  });
  const calls: Call[] = [];
  (adapter as any)._client = {
    apiCall: vi.fn(async (method: string, args: Record<string, unknown>) => {
      calls.push({ method, args });
      return { ok: true };
    }),
    assistant: {
      threads: {
        setStatus: vi.fn(async (args: Record<string, unknown>) => {
          calls.push({ method: 'assistant.threads.setStatus', args });
          return { ok: true };
        }),
      },
    },
  };
  // The native stream needs a live Slack; the wrapper only cares that it ends.
  adapter.stream = vi.fn(async () => null);
  return { adapter, calls };
}

function makeAdapter(config: { agentView?: boolean } = {}) {
  const { adapter, calls } = makeBase(config);
  return { adapter: withAgentSessionTyping(adapter), calls };
}

const sessionStatuses = (calls: Call[]) =>
  calls.filter(c => c.method === 'agents.sessions.setStatus').map(c => c.args.status);

describe('createSlackAdapter', () => {
  it('leaves the legacy assistant view alone', async () => {
    const adapter = createSlackAdapter({ botToken: 'xoxb-test', signingSecret: 'secret', userName: 'bot' });
    const setStatus = vi.fn(async () => ({ ok: true }));
    (adapter as any)._client = { apiCall: vi.fn(), assistant: { threads: { setStatus } } };

    expect(adapter.supportsTurnCancellation).toBe(false);
    await adapter.startTyping(THREAD, 'is thinking…');

    expect((adapter as any)._client.apiCall).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledTimes(1);
  });

  it('bridges typing statuses to the Agent Session under agentView', async () => {
    const adapter = createSlackAdapter({
      agentView: true,
      botToken: 'xoxb-test',
      signingSecret: 'secret',
      userName: 'bot',
    });
    const apiCall = vi.fn(async () => ({ ok: true }));
    (adapter as any)._client = { apiCall, assistant: { threads: { setStatus: vi.fn(async () => ({ ok: true })) } } };

    expect(adapter.supportsTurnCancellation).toBe(true);
    await adapter.startTyping(THREAD, 'is thinking…');

    expect(apiCall).toHaveBeenCalledWith(
      'agents.sessions.setStatus',
      expect.objectContaining({ status: 'processing' }),
    );
  });
});

describe('withAgentSessionTyping', () => {
  it('marks the session processing before a text status', async () => {
    const { adapter, calls } = makeAdapter({ agentView: true });

    await adapter.startTyping(THREAD, 'is thinking…', { initiatorUserId: 'U1' });

    expect(calls.map(c => c.method)).toEqual(['agents.sessions.setStatus', 'assistant.threads.setStatus']);
    expect(calls[0]!.args).toMatchObject({
      channel_id: 'C1',
      thread_ts: '1700.42',
      status: 'processing',
      initiator_user_id: 'U1',
    });
    expect(calls[1]!.args).toMatchObject({ status: 'is thinking…' });
  });

  it('re-opens a session that Slack ended between runs in the same thread', async () => {
    const { adapter, calls } = makeAdapter({ agentView: true });

    await adapter.startTyping(THREAD, 'is thinking…');
    // Ended outside the wrapper, as a finished reply stream or Stop does.
    await (adapter as any).setSessionStatus('C1', '1700.42', 'active');
    await adapter.startTyping(THREAD, 'is sleeping for 30 seconds');

    expect(sessionStatuses(calls)).toEqual(['processing', 'active', 'processing']);
    expect(calls.at(-1)!.args).toMatchObject({ status: 'is sleeping for 30 seconds' });
  });

  it('passes a clear and a bare startTyping straight through', async () => {
    const { adapter, calls } = makeAdapter({ agentView: true });

    await adapter.startTyping(THREAD);
    await adapter.startTyping(THREAD, '');

    expect(calls.map(c => c.method)).toEqual(['agents.sessions.setStatus', 'agents.sessions.setStatus']);
    expect(sessionStatuses(calls)).toEqual(['processing', 'active']);
  });
});
