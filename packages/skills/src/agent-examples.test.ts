/**
 * Agent Integration Examples
 *
 * These tests demonstrate how to use the Skills processors with Agents.
 * They are smoke tests that run the agent and log output - they don't assert
 * on specific LLM responses since those can vary.
 *
 * For unit tests of the processors themselves, see processors/skills.test.ts
 */
import { join } from 'node:path';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { describe, it } from 'vitest';

import { SkillsProcessor } from './processors';

const FIXTURES_PATH = join(__dirname, '__fixtures__', 'skills');

describe('Agent with SkillsProcessor Examples', () => {
  it('should run agent with skills processor (tool-based activation)', async () => {
    const processor = new SkillsProcessor({
      skillsPaths: FIXTURES_PATH,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'skills-agent',
      name: 'Skills Agent',
      instructions: 'You are an agent that can use skills. When asked about a topic, activate the relevant skill.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('How do I process a PDF file?');

    console.log('Agent response (skills processor with tools):', result.text);
  }, 60000);
});
