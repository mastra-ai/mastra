import { google } from '@ai-sdk/google-v5';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { MockMemory } from './test-utils';
import { Agent } from './index';

describe('Agent - network with Gemini', () => {
  const memory = new MockMemory();

  // Agent 1: Research agent using Gemini
  const agent1 = new Agent({
    name: 'gemini-agent1',
    instructions:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    description:
      'This agent is used to do research, but not create full responses. Answer in bullet points only and be concise.',
    model: google('gemini-2.5-flash-lite'),
  });

  // Agent 2: Synthesis agent using Gemini
  const agent2 = new Agent({
    name: 'gemini-agent2',
    description:
      'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs.',
    instructions:
      'This agent is used to do text synthesis on researched material. Write a full report based on the researched material. Do not use bullet points. Write full paragraphs. [IMPORTANT] Make sure to mention information that has been highlighted as relevant in message history.',
    model: google('gemini-2.5-flash-lite'),
  });

  const agentStep1 = createStep({
    id: 'gemini-agent-step-1',
    description: 'This step is used to do research with Gemini.',
    inputSchema: z.object({
      city: z.string().describe('The city to research'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await agent1.generateVNext(inputData.city, {
        output: z.object({
          text: z.string(),
        }),
      });

      return { text: resp.object.text };
    },
  });

  const agentStep2 = createStep({
    id: 'gemini-agent-step-2',
    description: 'This step is used to synthesize with Gemini.',
    inputSchema: z.object({
      text: z.string().describe('The text to synthesize'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ inputData }) => {
      const resp = await agent2.generateVNext(inputData.text, {
        output: z.object({
          text: z.string(),
        }),
      });

      return { text: resp.object.text };
    },
  });

  const workflow1 = createWorkflow({
    id: 'gemini-workflow1',
    description: 'This workflow is perfect for researching a specific city using Gemini.',
    steps: [],
    inputSchema: z.object({
      city: z.string(),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
  })
    .then(agentStep1)
    .then(agentStep2)
    .commit();

  const tool = createTool({
    id: 'gemini-tool1',
    description: 'This tool will tell you about "cool stuff"',
    inputSchema: z.object({
      howCool: z.string().describe('How cool is the stuff?'),
    }),
    outputSchema: z.object({
      text: z.string(),
    }),
    execute: async ({ context, ...rest }) => {
      await rest.writer?.write({
        type: 'my-custom-tool-payload',
        payload: {
          context,
        },
      });

      return { text: `This is a test tool. How cool is the stuff? ${context.howCool}` };
    },
  });

  // Main network agent using Gemini
  const network = new Agent({
    id: 'test-network-gemini',
    name: 'Test Network Gemini',
    instructions:
      'You can research cities. You can also synthesize research material. You can also write a full report based on the researched material.',
    model: google('gemini-2.5-flash-lite'),
    agents: {
      agent1,
      agent2,
    },
    workflows: {
      workflow1,
    },
    tools: {
      tool,
    },
    memory: memory as any,
  });

  const runtimeContext = new RuntimeContext();

  describe('Gemini message ordering compatibility', () => {
    it('should handle tool execution with proper message ordering', async () => {
      const anStream = await network.network('Execute gemini-tool1', {
        runtimeContext,
      });

      const chunks = [];
      for await (const chunk of anStream) {
        chunks.push(chunk);
      }

      // Verify we got a response without Gemini errors
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle workflow execution with proper message ordering', async () => {
      const anStream = await network.network('Execute gemini-workflow1 on Paris', {
        runtimeContext,
      });

      const chunks = [];
      for await (const chunk of anStream) {
        chunks.push(chunk);
      }

      // Verify workflow executed without Gemini message ordering errors
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle single agent execution with proper message ordering', async () => {
      const anStream = await network.network('Research dolphins using gemini', {
        runtimeContext,
      });

      const chunks = [];
      for await (const chunk of anStream) {
        chunks.push(chunk);
      }

      // Verify agent executed without Gemini errors
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle multi-step execution with proper message ordering', async () => {
      const anStream = await network.network(
        'Research dolphins then execute gemini-workflow1 based on the location where dolphins live',
        {
          runtimeContext,
          maxSteps: 3,
        },
      );

      const chunks = [];
      for await (const chunk of anStream) {
        chunks.push(chunk);
      }

      // Verify multi-step execution worked without Gemini errors
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Gemini-specific edge cases', () => {
    it('should handle empty context correctly', async () => {
      const emptyNetwork = new Agent({
        id: 'empty-network-gemini',
        name: 'Empty Network Gemini',
        instructions: 'You are a helpful assistant',
        model: google('gemini-2.5-flash-lite'),
      });

      const stream = await emptyNetwork.network('Hello', {
        runtimeContext,
      });

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle system-only context correctly', async () => {
      const systemOnlyAgent = new Agent({
        id: 'system-only-gemini',
        name: 'System Only Gemini',
        instructions: 'You are an expert on marine biology. You always respond with scientific facts.',
        model: google('gemini-2.5-flash-lite'),
      });

      // Add only system context, no user messages initially
      const stream = await systemOnlyAgent.generateVNext('', {
        systemPrompt: 'Always be scientific and accurate',
      });

      expect(stream).toBeDefined();
      // Should not throw Gemini error about message ordering
    });

    it('should handle tool calls and results correctly', async () => {
      const weatherTool = createTool({
        id: 'get-weather',
        description: 'Get weather for a location',
        inputSchema: z.object({
          location: z.string(),
        }),
        outputSchema: z.object({
          temperature: z.number(),
          condition: z.string(),
        }),
        execute: async ({ context }) => {
          return { temperature: 72, condition: 'Sunny' };
        },
      });

      const agentWithTool = new Agent({
        id: 'tool-agent-gemini',
        name: 'Tool Agent Gemini',
        instructions: 'You can check the weather',
        model: google('gemini-2.5-flash-lite'),
        tools: { weatherTool },
      });

      const stream = await agentWithTool.network('What is the weather in San Francisco?', {
        runtimeContext,
      });

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      // Should handle tool calls and results without Gemini message ordering errors
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
}, 120e3);
