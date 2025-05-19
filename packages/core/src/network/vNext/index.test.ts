import { describe, it } from 'vitest';
import { openai } from '@ai-sdk/openai';
import { Agent } from '../../agent';
import { NewAgentNetwork } from './index';
import { RuntimeContext } from '../../runtime-context';

describe('NewAgentNetwork', () => {
  it('should create a new agent network', async () => {
    const agent1 = new Agent({
      name: 'agent1',
      instructions: 'Test instructions',
      description: 'This agent is used to do Mathematics',
      model: openai('gpt-4o'),
    });

    const agent2 = new Agent({
      name: 'agent2',
      description: 'This agent is used to do text synthesis',
      instructions: 'Test instructions',
      model: openai('gpt-4o'),
    });

    const network = new NewAgentNetwork({
      id: 'test-network',
      name: 'Test Network',
      instructions: 'You are a network of writers and researchers. The user will ask you to research a topic.',
      model: openai('gpt-4o'),
      agents: {
        agent1,
        agent2,
      },
    });

    const runtimeContext = new RuntimeContext();

    console.log(await network.generate('What is the capital of France?', { runtimeContext }));
  });
});
