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
    void agent.stream('hello', options);
    void agent.streamUntilIdle('hello', options);
    void agent.resumeStream({}, options);
    void agent.resumeStreamUntilIdle({}, options);
    void agent.subscribeToThread({ ...target, ...options });
    void durable.stream('hello', options);
    void durable.streamUntilIdle('hello', options);
    void durable.resume('run', {}, options);
    void durable.subscribeToThread({ ...target, ...options });
    void agent.generate('hello', options);
    void agent.resumeGenerate({}, options);
    void durable.generate('hello', options);
    void durable.resumeGenerate('run', {}, options);
  });

  it('accepts shared execution options without adding filtering to identity APIs', () => {
    void agent.stream('hello', options);
    void agent.streamUntilIdle('hello', options);
    void agent.resumeStream({}, options);
    void agent.resumeStreamUntilIdle({}, options);
    void agent.subscribeToThread({ ...target, ...options });
    void durable.stream('hello', options);
    void durable.streamUntilIdle('hello', options);
    void durable.resume('run', {}, options);
    void durable.subscribeToThread({ ...target, ...options });
    void agent.generate('hello', options);
    void agent.resumeGenerate({}, options);
    void durable.generate('hello', options);
    void durable.resumeGenerate('run', {}, options);

    // @ts-expect-error the unshipped spelling is not a compatibility alias
    void agent.stream('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error the unshipped spelling is not a compatibility alias
    void agent.subscribeToThread({ ...target, excludeSignals: ['reactive'] });
    // @ts-expect-error durable streams use the same public spelling
    void durable.stream('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error the unshipped spelling is not a generation option
    void agent.generate('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error abort accepts identity only
    void agent.abortThreadStream({ ...target, hideSignals: ['reactive'] });
    // @ts-expect-error lookup accepts identity only
    void agent.getActiveThreadRunId({ ...target, hideSignals: ['reactive'] });
    // @ts-expect-error durable abort accepts identity only
    void durable.abortThreadStream({ ...target, hideSignals: ['reactive'] });
    // @ts-expect-error invalid signal literal
    void agent.stream('hello', { hideSignals: ['unknown'] });
    // @ts-expect-error shared execution options still validate signal literals
    void agent.generate('hello', { hideSignals: ['unknown'] });
  });
});
