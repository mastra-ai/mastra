import { describe, expectTypeOf, it } from 'vitest';
import type { FullOutput, MastraModelOutput } from '../../stream/base/output';
import type { MessageListInput } from '../message-list';
import type { ToolsInput } from '../types';
import { DurableAgent } from './durable-agent';
import { EventedAgent } from './evented-agent';
import type { DurableAgentStreamOptions, DurableAgentStreamResult } from './types';

type DurableAgentResumeOptions<OUTPUT> = Parameters<DurableAgent<string, ToolsInput, OUTPUT>['resume']>[2];

type Answer = { answer: string };

// Consumers can instrument the legacy APIs with method overrides and super calls.
function instrumentAgent(Base: typeof DurableAgent) {
  return class extends Base<string, ToolsInput, Answer> {
    override stream(messages: MessageListInput, options?: DurableAgentStreamOptions<Answer>) {
      return super.stream(messages, options);
    }

    override resumeStream(resumeData: unknown, options?: DurableAgentResumeOptions<Answer> & { runId?: string }) {
      return super.resumeStream(resumeData, options);
    }

    override generate(messages: MessageListInput, options?: DurableAgentStreamOptions<Answer>) {
      return super.generate(messages, options);
    }

    override resumeGenerate(
      resumeData: unknown,
      options: DurableAgentResumeOptions<Answer> & { runId: string },
    ): Promise<FullOutput<Answer>>;
    override resumeGenerate(
      runId: string,
      resumeData: unknown,
      options?: DurableAgentResumeOptions<Answer>,
    ): Promise<FullOutput<Answer>>;
    override resumeGenerate(...args: unknown[]): Promise<FullOutput<Answer>> {
      if (typeof args[0] === 'string' && args.length === 3) {
        return super.resumeGenerate(args[0], args[1], args[2] as DurableAgentResumeOptions<Answer>);
      }
      return super.resumeGenerate(args[0], args[1] as DurableAgentResumeOptions<Answer> & { runId: string });
    }

    override observe(runId: string, options?: Parameters<DurableAgent<string, ToolsInput, Answer>['observe']>[1]) {
      return super.observe(runId, options);
    }

    override streamUntilIdle<OUTPUT = Answer>(
      messages: MessageListInput,
      options?: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
    ) {
      return super.streamUntilIdle<OUTPUT>(messages, options);
    }
  };
}

class InstrumentedEventedAgent extends EventedAgent<string, ToolsInput, Answer> {
  override stream(messages: MessageListInput, options?: DurableAgentStreamOptions<Answer>) {
    return super.stream(messages, options);
  }

  override resumeStream(resumeData: unknown, options?: DurableAgentResumeOptions<Answer> & { runId?: string }) {
    return super.resumeStream(resumeData, options);
  }

  override generate(messages: MessageListInput, options?: DurableAgentStreamOptions<Answer>) {
    return super.generate(messages, options);
  }

  override resumeGenerate(
    resumeData: unknown,
    options: DurableAgentResumeOptions<Answer> & { runId: string },
  ): Promise<FullOutput<Answer>>;
  override resumeGenerate(
    runId: string,
    resumeData: unknown,
    options?: DurableAgentResumeOptions<Answer>,
  ): Promise<FullOutput<Answer>>;
  override resumeGenerate(...args: unknown[]): Promise<FullOutput<Answer>> {
    if (typeof args[0] === 'string' && args.length === 3) {
      return super.resumeGenerate(args[0], args[1], args[2] as DurableAgentResumeOptions<Answer>);
    }
    return super.resumeGenerate(args[0], args[1] as DurableAgentResumeOptions<Answer> & { runId: string });
  }

  override observe(runId: string, options?: Parameters<EventedAgent<string, ToolsInput, Answer>['observe']>[1]) {
    return super.observe(runId, options);
  }

  override streamUntilIdle<OUTPUT = Answer>(
    messages: MessageListInput,
    options?: DurableAgentStreamOptions<OUTPUT> & { maxIdleMs?: number },
  ) {
    return super.streamUntilIdle<OUTPUT>(messages, options);
  }
}

declare const durable: InstanceType<ReturnType<typeof instrumentAgent>>;
declare const evented: InstrumentedEventedAgent;

instrumentAgent(DurableAgent);

describe('legacy durable method overrides', () => {
  it('preserves durable return types and observer options through super', () => {
    for (const agent of [durable, evented]) {
      expectTypeOf(agent.stream('hello')).toEqualTypeOf<Promise<DurableAgentStreamResult<Answer>>>();
      expectTypeOf(agent.resumeStream({ approved: true }, { runId: 'run' })).toEqualTypeOf<
        Promise<MastraModelOutput<Answer>>
      >();
      expectTypeOf(agent.generate('hello', { closeOnSuspend: true })).toEqualTypeOf<Promise<FullOutput<Answer>>>();
      expectTypeOf(agent.resumeGenerate({ approved: true }, { runId: 'run' })).toEqualTypeOf<
        Promise<FullOutput<Answer>>
      >();
      expectTypeOf(agent.resumeGenerate('run', { approved: true }, {})).toEqualTypeOf<Promise<FullOutput<Answer>>>();
      expectTypeOf(agent.streamUntilIdle<{ count: number }>('hello', { maxIdleMs: 100 })).toEqualTypeOf<
        Promise<DurableAgentStreamResult<{ count: number }>>
      >();
      expectTypeOf(agent.observe('run', { idleTimeoutMs: 100, isAlive: () => true, onAbort: () => {} })).toEqualTypeOf<
        Promise<Omit<DurableAgentStreamResult<Answer>, 'runId'> & { runId: string; detach: () => void }>
      >();
    }
  });
});
