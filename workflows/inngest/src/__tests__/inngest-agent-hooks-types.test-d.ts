/**
 * Type-level regression tests for github.com/mastra-ai/mastra/issues/27430:
 * per-call tool hooks must type-check on InngestAgent.stream() and resume().
 */
import type { AgentExecutionOptions } from '@mastra/core/agent';
import { describe, it, expectTypeOf } from 'vitest';

import type { InngestAgentResumeOptions, InngestAgentStreamOptions } from '../durable-agent/create-inngest-agent';

type Hooks = AgentExecutionOptions['hooks'];

describe('InngestAgent per-call tool hooks', () => {
  it('accepts hooks on stream options', () => {
    expectTypeOf<InngestAgentStreamOptions>().toHaveProperty('hooks');
    expectTypeOf<InngestAgentStreamOptions['hooks']>().toEqualTypeOf<Hooks>();
  });

  it('accepts hooks on resume options', () => {
    expectTypeOf<InngestAgentResumeOptions['hooks']>().toEqualTypeOf<Hooks>();
  });
});
