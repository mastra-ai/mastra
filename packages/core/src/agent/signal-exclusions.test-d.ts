import { describe, it } from 'vitest';
import type { Agent } from './agent';
import type { AgentExecutionOptionsBase, AgentStreamSignalOptions } from './agent.types';
import type { DurableAgent } from './durable/durable-agent';

declare const agent: Agent;
declare const durable: DurableAgent;
const target = { threadId: 'thread', resourceId: 'resource' };
const options: AgentStreamSignalOptions = {
  excludeSignals: ['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder'],
};

describe('signal exclusions API ownership', () => {
  it('accepts exclusions only on streaming and subscription surfaces', () => {
    void agent.stream('hello', options);
    void agent.streamUntilIdle('hello', options);
    void agent.resumeStream({}, options);
    void agent.resumeStreamUntilIdle({}, options);
    void agent.subscribeToThread({ ...target, ...options });
    void durable.stream('hello', options);
    void durable.streamUntilIdle('hello', options);
    void durable.resume('run', {}, options);
    void durable.subscribeToThread({ ...target, ...options });

    // @ts-expect-error exclusions are not generation options
    void agent.generate('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error exclusions are not generation options
    void agent.resumeGenerate({}, { excludeSignals: ['reactive'] });
    // @ts-expect-error abort accepts identity only
    void agent.abortThreadStream({ ...target, excludeSignals: ['reactive'] });
    // @ts-expect-error lookup accepts identity only
    void agent.getActiveThreadRunId({ ...target, excludeSignals: ['reactive'] });
    // @ts-expect-error durable generation does not expose exclusions
    void durable.generate('hello', { excludeSignals: ['reactive'] });
    // @ts-expect-error durable resume generation does not expose exclusions
    void durable.resumeGenerate('run', {}, { excludeSignals: ['reactive'] });
    // @ts-expect-error durable abort accepts identity only
    void durable.abortThreadStream({ ...target, excludeSignals: ['reactive'] });
    // @ts-expect-error invalid signal literal
    void agent.stream('hello', { excludeSignals: ['unknown'] });
    // @ts-expect-error exclusions must not leak to shared execution options
    const base: AgentExecutionOptionsBase = { excludeSignals: ['reactive'] };
    void base;
  });
});
