import { describe, it } from 'vitest';
import { openai } from '@ai-sdk/openai';
import { Agent } from '../../agent';
import { NewAgentNetwork } from './index';
import { RuntimeContext } from '../../runtime-context';
import { createWorkflow } from '../../workflows/vNext';

describe('NewAgentNetwork', () => {
  it('should create a new agent network', async () => {
    const agent1 = new Agent({
      name: 'agent1',
      instructions: 'Test instructions',
      description:
        'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
      model: openai('gpt-4o'),
    });

    const agent2 = new Agent({
      name: 'agent2',
      description:
        'This agent is used to do text synthesis on researched material. Write a full report based on the researched material.',
      instructions: 'Test instructions',
      model: openai('gpt-4o'),
    });

    const network = new NewAgentNetwork({
      id: 'test-network',
      name: 'Test Network',
      instructions:
        'You are a network of writers and researchers. The user will ask you to research a topic. You always need to answer with a full report. Bullet points are NOT a full report. WRITE FULL PARAGRAPHS like this is a blog post or something similar.',
      model: openai('gpt-4o'),
      agents: {
        agent1,
        agent2,
      },
    });

    const runtimeContext = new RuntimeContext();

    console.log(
      await network.generate('What are the biggest cities in France? How are they like?', { runtimeContext }),
    );
  });
}, 60e3);
