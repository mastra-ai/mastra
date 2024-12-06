import { describe, it, expect, jest } from '@jest/globals';
import { z } from 'zod';

import { TestIntegration } from '../integration/integration.mock';
import { Mastra } from '../mastra';
import { createTool } from '../tools';

import { Agent, type ModelConfig } from '..';

const mockFindUser = jest.fn().mockImplementation(async data => {
  const list = [
    { name: 'Dero Israel', email: 'dero@mail.com' },
    { name: 'Ife Dayo', email: 'dayo@mail.com' },
    { name: 'Tao Feeq', email: 'feeq@mail.com' },
  ];

  const userInfo = list?.find(({ name }) => name === (data as { name: string }).name);
  if (!userInfo) return { message: 'User not found' };
  return userInfo;
});

describe('agent', () => {
  const modelConfig: ModelConfig = {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  };

  it('should get a text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const mastra = new Mastra({
      agents: [electionAgent],
    });

    const agentOne = mastra.getAgent('US Election agent');

    const response = await agentOne.text({
      messages: ['Who won the 2016 US presidential election?'],
    });

    const { text, toolCalls } = response;

    expect(text).toContain('Donald Trump');
    expect(toolCalls.length).toBeLessThan(1);
  });

  it('should get a streamed text response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const mastra = new Mastra({
      agents: [electionAgent],
    });

    const agentOne = mastra.getAgent('US Election agent');

    const response = await agentOne.stream({
      messages: ['Who won the 2016 US presidential election?'],
    });

    const { textStream } = response;

    let previousText = '';
    let finalText = '';
    for await (const textPart of textStream) {
      expect(textPart === previousText).toBe(false);
      previousText = textPart;
      finalText = finalText + previousText;
      expect(textPart).toBeDefined();
    }

    expect(finalText).toContain('Donald Trump');
  });

  it('should get a structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const mastra = new Mastra({
      agents: [electionAgent],
    });

    const agentOne = mastra.getAgent('US Election agent');

    const response = await agentOne.textObject({
      messages: ['Who won the 2012 US presidential election?'],
      structuredOutput: {
        winner: {
          type: 'string',
        },
      },
    });

    const { object } = response;

    expect(object.winner).toBe('Barack Obama');
  });

  it('should support ZodSchema structured output type', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const mastra = new Mastra({
      agents: [electionAgent],
    });

    const agentOne = mastra.getAgent('US Election agent');

    const response = await agentOne.textObject({
      messages: ['Give me the winners of 2012 and 2016 US presidential elections'],
      structuredOutput: z.array(
        z.object({
          winner: z.string(),
          year: z.string(),
        }),
      ),
    });

    const { object } = response;

    expect(object.length).toBeGreaterThan(1);
    expect(object).toMatchObject([
      {
        year: '2012',
        winner: 'Barack Obama',
      },
      {
        year: '2016',
        winner: 'Donald Trump',
      },
    ]);
  });

  it('should get a streamed structured response from the agent', async () => {
    const electionAgent = new Agent({
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: modelConfig,
    });

    const mastra = new Mastra({
      agents: [electionAgent],
    });

    const agentOne = mastra.getAgent('US Election agent');

    const response = await agentOne.streamObject({
      messages: ['Who won the 2012 US presidential election?'],
      structuredOutput: {
        winner: {
          type: 'string',
        },
      },
    });

    const { partialObjectStream } = response;

    let previousPartialObject = {} as { winner: string };
    for await (const partialObject of partialObjectStream) {
      if (partialObject['winner'] && previousPartialObject['winner']) {
        expect(partialObject['winner'] === previousPartialObject['winner']).toBe(false);
      }
      previousPartialObject = partialObject as { winner: string };
      expect(partialObject).toBeDefined();
    }

    expect(previousPartialObject['winner']).toBe('Barack Obama');
  });

  it('should call findUserTool', async () => {
    const findUserTool = createTool({
      label: 'Find user tool',
      description: 'This is a test tool that returns the name and email',
      schema: z.object({
        name: z.string(),
      }),
      executor: ({ data }) => {
        return mockFindUser(data) as Promise<Record<string, any>>;
      },
    });

    const userAgent = new Agent({
      name: 'User agent',
      instructions: 'You are an agent that can get list of users using listUsersTool',
      model: {
        ...modelConfig,
        toolChoice: 'required',
      },
      enabledTools: { findUserTool: true },
    });

    const mastra = new Mastra({
      agents: [userAgent],
      tools: {
        findUserTool,
      },
    });

    const agentOne = mastra.getAgent('User agent');

    const response = await agentOne.text({
      messages: ['Find the user with name - Dero Israel'],
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'findUserTool');

    const name = toolCall?.result?.name;

    expect(mockFindUser).toHaveBeenCalled();
    expect(name).toBe('Dero Israel');
  });

  it('should call testTool from TestIntegration', async () => {
    const testAgent = new Agent({
      name: 'Test agent',
      instructions: 'You are an agent that call testTool',
      model: {
        ...modelConfig,
        toolChoice: 'required',
      },
      enabledTools: { testTool: true },
    });

    const mastra = new Mastra({
      agents: [testAgent],
      integrations: [new TestIntegration()],
    });

    const agentOne = mastra.getAgent('Test agent');

    const response = await agentOne.text({
      messages: ['Call testTool'],
    });

    const toolCall: any = response.toolResults.find((result: any) => result.toolName === 'testTool');

    const message = toolCall?.result?.message;

    expect(message).toBe('Executed successfully');
  }, 10000);
});
