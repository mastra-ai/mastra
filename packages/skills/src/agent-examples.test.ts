/**
 * Agent Integration Examples
 *
 * These tests demonstrate how to use the Skills processors with Agents.
 * They are smoke tests that run the agent and log output - they don't assert
 * on specific LLM responses since those can vary.
 *
 * For unit tests of the processors themselves, see integration.test.ts
 */
import { join } from 'node:path';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { describe, it, beforeEach } from 'vitest';

import { SkillsProcessor, StaticSkills, RetrievedSkills } from './processors';
import { Skills } from './skills';

const FIXTURES_PATH = join(__dirname, '__fixtures__', 'skills');

describe('Agent with StaticSkills Examples', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  it('should run agent with static skills (XML format)', async () => {
    const staticSkillsProcessor = new StaticSkills({
      skills,
      skillNames: ['pdf-processing'],
      format: 'xml',
    });

    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You are a helpful agent with skills.',
      model: openai('gpt-4o'),
      inputProcessors: [staticSkillsProcessor],
    });

    const result = await agent.generate('How do I process a PDF?');

    console.log('Agent response (static skills, XML format):', result.text);
  });

  it('should run agent with static skills (markdown format)', async () => {
    const processor = new StaticSkills({
      skills,
      skillNames: ['data-analysis'],
      format: 'markdown',
    });

    const agent = new Agent({
      id: 'help-agent',
      name: 'Help Agent',
      instructions: 'You help users.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('How do I analyze data?');

    console.log('Agent response (static skills, markdown format):', result.text);
  });

  it('should run agent with custom formatter', async () => {
    const processor = new StaticSkills({
      skills,
      skillNames: ['pdf-processing'],
      formatter: skills => {
        return `=== CUSTOM FORMAT ===\n${skills.map(s => `* ${s.name}: ${s.instructions.substring(0, 50)}...`).join('\n')}\n=== END ===`;
      },
    });

    const agent = new Agent({
      id: 'custom-agent',
      name: 'Custom Agent',
      instructions: 'You are custom.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('Hello');

    console.log('Agent response (custom formatter):', result.text);
  });
});

describe('Agent with RetrievedSkills Examples', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  it('should run agent with retrieved skills (XML format)', async () => {
    const processor = new RetrievedSkills({
      skills,
      topK: 3,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'support-agent',
      name: 'Support Agent',
      instructions: 'You are a helpful support agent.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('How do I process PDF files?');

    console.log('Agent response (retrieved skills, XML format):', result.text);
  }, 60000);

  it('should run agent with retrieved skills (markdown format)', async () => {
    const processor = new RetrievedSkills({
      skills,
      format: 'markdown',
    });

    const agent = new Agent({
      id: 'guide-agent',
      name: 'Guide Agent',
      instructions: 'You help users.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    const result = await agent.generate('Tell me about data analysis');

    console.log('Agent response (retrieved skills, markdown format):', result.text);
  }, 60000);

  it('should run agent with custom query extractor', async () => {
    const processor = new RetrievedSkills({
      skills,
      queryExtractor: () => 'data analysis',
      format: 'plain',
    });

    const agent = new Agent({
      id: 'agent',
      name: 'Agent',
      instructions: 'Helper.',
      model: openai('gpt-4o'),
      inputProcessors: [processor],
    });

    // Even though user asks about PDF, we search for data analysis
    const result = await agent.generate('How do I process PDF files?');

    console.log('Agent response (custom query extractor):', result.text);
  }, 60000);
});

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

describe('Agent with Hybrid Skills Examples', () => {
  let skills: Skills;

  beforeEach(() => {
    skills = new Skills({
      id: 'test-skills',
      paths: FIXTURES_PATH,
    });
  });

  it('should run agent with both static and retrieved skills', async () => {
    // Static skills always injected
    const staticProcessor = new StaticSkills({
      skills,
      skillNames: ['data-analysis'],
      format: 'xml',
    });

    // Retrieved skills based on query
    const retrievedProcessor = new RetrievedSkills({
      skills,
      format: 'xml',
    });

    const agent = new Agent({
      id: 'hybrid-agent',
      name: 'Hybrid Agent',
      instructions: 'You have both static and retrieved skills.',
      model: openai('gpt-4o'),
      inputProcessors: [staticProcessor, retrievedProcessor],
    });

    const result = await agent.generate('How do I process PDF files?');

    console.log('Agent response (hybrid skills):', result.text);
  }, 60000);
});
