import { Agent, type SubAgent } from '@mastra/core/agent';
import { describe, expectTypeOf, it } from 'vitest';

const staticGenerateResult = {
  text: 'Static fake agent response',
} as Awaited<ReturnType<SubAgent['generate']>>;

const staticStreamResult = {
  text: Promise.resolve('Static fake agent stream response'),
} as Awaited<ReturnType<SubAgent['stream']>>;

class FakeSubAgent implements SubAgent {
  readonly id = 'fake-subagent';
  readonly name = 'Fake SubAgent';

  getDescription(): string {
    return 'A fake subagent that returns static responses';
  }

  getModel: SubAgent['getModel'] = () =>
    ({
      modelId: 'fake-model',
      provider: 'fake-provider',
    }) as Awaited<ReturnType<SubAgent['getModel']>>;

  hasOwnMemory(): boolean {
    return false;
  }

  __setMemory: SubAgent['__setMemory'] = () => {};

  getMemory: SubAgent['getMemory'] = async () => undefined;

  getInstructions: SubAgent['getInstructions'] = () => 'Always return a static response';

  generate: SubAgent['generate'] = async () => staticGenerateResult;

  stream: SubAgent['stream'] = async () => staticStreamResult;

  resumeGenerate: SubAgent['resumeGenerate'] = async () => staticGenerateResult;

  resumeStream: SubAgent['resumeStream'] = async () => staticStreamResult;
}

const standardAgent = new Agent({
  id: 'standard-agent',
  name: 'Standard Agent',
  instructions: 'You are a helpful assistant',
  model: 'openai/gpt-4o',
});

describe('SubAgent', () => {
  it('accepts custom class implementations that do not extend Agent', () => {
    expectTypeOf<FakeSubAgent>().toExtend<SubAgent>();
    expectTypeOf(new FakeSubAgent()).toExtend<SubAgent>();
  });

  it('keeps Agent instances assignable as SubAgent values', () => {
    expectTypeOf<Agent>().toExtend<SubAgent>();
    expectTypeOf(standardAgent).toExtend<SubAgent>();
  });

  it('accepts custom SubAgent implementations in Agent config', () => {
    const supervisor = new Agent({
      id: 'supervisor-agent',
      name: 'Supervisor Agent',
      instructions: 'Delegate to the fake subagent when useful',
      model: 'openai/gpt-4o',
      agents: {
        fake: new FakeSubAgent(),
        standard: standardAgent,
      },
    });

    expectTypeOf(supervisor).toExtend<Agent>();
  });

  it('rejects objects missing required SubAgent methods', () => {
    const incompleteSubAgent = {
      id: 'incomplete-subagent',
      getDescription: () => 'Missing generate and other required methods',
    };

    new Agent({
      id: 'invalid-supervisor-agent',
      name: 'Invalid Supervisor Agent',
      instructions: 'This should reject incomplete subagents',
      model: 'openai/gpt-4o',
      agents: {
        // @ts-expect-error incompleteSubAgent is missing required SubAgent methods
        incomplete: incompleteSubAgent,
      },
    });
  });
});
