import { describe, it } from 'vitest';
import type { Agent } from './agent';
import type { AgentExecutionOptionsBase } from './agent.types';
import type { DurableAgent } from './durable/durable-agent';

declare const agent: Agent;
declare const durable: DurableAgent;
const target = { threadId: 'thread', resourceId: 'resource' };
const options = {
  hideSignals: ['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder'],
} satisfies AgentExecutionOptionsBase<unknown>;

describe('signal visibility API ownership', () => {
  it.each([true, false])('accepts boolean hideSignals=%s on execution and subscriptions', hideSignals => {
    const options = { hideSignals } satisfies AgentExecutionOptionsBase<unknown>;
    void agent.streamMessageList('hello', options);
    void agent.streamUntilIdle('hello', options);
    void agent.resumeStream({}, options);
    void agent.resumeStreamUntilIdle({}, options);
    void agent.subscribeToThread({ ...target, ...options });
    void durable.streamMessageList('hello', options);
    void durable.streamUntilIdle('hello', options);
    void durable.resume('run', {}, options);
    void durable.subscribeToThread({ ...target, ...options });
    void agent.generateMessageList('hello', options);
    void agent.resumeGenerate({}, options);
    void durable.generateMessageList('hello', options);
    void durable.resumeGenerate('run', {}, options);
  });

  it('accepts shared execution options without adding filtering to identity APIs', () => {
    void agent.streamMessageList('hello', options);
    void agent.streamUntilIdle('hello', options);
    void agent.resumeStream({}, options);
    void agent.resumeStreamUntilIdle({}, options);
    void agent.subscribeToThread({ ...target, ...options });
    void durable.streamMessageList('hello', options);
    void durable.streamUntilIdle('hello', options);
    void durable.resume('run', {}, options);
    void durable.subscribeToThread({ ...target, ...options });
    void agent.generateMessageList('hello', options);
    void agent.resumeGenerate({}, options);
    void durable.generateMessageList('hello', options);
    void durable.resumeGenerate('run', {}, options);

    // @ts-expect-error the unshipped spelling is not a compatibility alias
    void agent.streamMessageList('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error the unshipped spelling is not a compatibility alias
    void agent.subscribeToThread({ ...target, excludeSignals: ['reactive'] });
    // @ts-expect-error durable streams use the same public spelling
    void durable.streamMessageList('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error the unshipped spelling is not a generation option
    void agent.generateMessageList('hello', { excludeSignals: ['reactive'] });
    void agent.abortThreadStream({ ...target, expectedRunId: 'run-id' });
    void durable.abortThreadStream({ ...target, expectedRunId: 'run-id' });
    // @ts-expect-error abort does not accept subscription signal filters
    void agent.abortThreadStream({ ...target, hideSignals: ['reactive'] });
    // @ts-expect-error lookup accepts identity only
    void agent.getActiveThreadRunId({ ...target, expectedRunId: 'run-id' });
    // @ts-expect-error durable abort does not accept subscription signal filters
    void durable.abortThreadStream({ ...target, hideSignals: ['reactive'] });
    // @ts-expect-error invalid signal literal
    void agent.streamMessageList('hello', { hideSignals: ['unknown'] });
    // @ts-expect-error shared execution options still validate signal literals
    void agent.generateMessageList('hello', { hideSignals: ['unknown'] });
  });
});
