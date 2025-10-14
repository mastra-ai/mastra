import { google } from '@ai-sdk/google';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../runtime-context';
import { createTool } from '../tools';
import { createStep, createWorkflow } from '../workflows';
import { MockMemory } from './test-utils';
import { Agent } from './index';
import type { ChunkType } from '../stream/types';

describe('Gemini Model Compatibility Tests', () => {
  let memory: MockMemory;
  let runtimeContext: RuntimeContext;

  beforeEach(() => {
    memory = new MockMemory();
    runtimeContext = new RuntimeContext();
  });

  describe('Direct generate() method - Gemini basic functionality', () => {
    it('should handle basic generation with Gemini', async () => {
      const agent = new Agent({
        id: 'basic-gemini',
        name: 'Basic Gemini Agent',
        instructions: 'You are a helpful assistant',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await agent.generate('Hello, how are you?');
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });

    it('should handle generation with structured output', async () => {
      const agent = new Agent({
        id: 'structured-gemini',
        name: 'Structured Gemini Agent',
        instructions: 'You provide structured responses',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await agent.generate('List 3 benefits of exercise', {
        output: z.object({
          benefits: z.array(z.string()),
        }),
      });

      expect(result.object).toBeDefined();
      expect(result.object.benefits).toBeDefined();
      expect(Array.isArray(result.object.benefits)).toBe(true);
    });

    it('should handle empty user message with system context', async () => {
      const agent = new Agent({
        id: 'system-context-agent',
        name: 'System Context Agent',
        instructions: 'You are an expert assistant',
        model: google('gemini-2.5-flash-lite'),
      });

      // This tests if empty user message is properly handled for Gemini
      const result = await agent.generate('', {
        system: 'Always provide detailed explanations',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Agent network() method - Testing Issues #8053 and #8732', () => {
    it('should handle simple network call', async () => {
      const agent = new Agent({
        id: 'simple-network',
        name: 'Simple Network Agent',
        instructions: 'You are a helpful assistant',
        model: google('gemini-2.5-flash-lite'),
        memory,
      });

      const stream = await agent.network('What is 2+2?', {
        runtimeContext,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle network with continuing conversation', async () => {
      const agent = new Agent({
        id: 'conversation-agent',
        name: 'Conversation Agent',
        instructions: 'You maintain context across conversations',
        model: google('gemini-2.5-flash-lite'),
        memory,
      });

      // First interaction
      const stream1 = await agent.network('My name is Alice', {
        runtimeContext,
        memory: {
          thread: 'conv-thread',
          resource: 'conv-resource',
        },
      });

      const chunks1: ChunkType[] = [];
      for await (const chunk of stream1) {
        chunks1.push(chunk);
      }

      // Second interaction - this will have memory from first
      const stream2 = await agent.network('What is my name?', {
        runtimeContext,
        memory: {
          thread: 'conv-thread',
          resource: 'conv-resource',
        },
      });

      const chunks2: ChunkType[] = [];
      for await (const chunk of stream2) {
        chunks2.push(chunk);
      }

      expect(chunks2).toBeDefined();
      expect(chunks2.length).toBeGreaterThan(0);
    });

    it('should handle network with sub-agents', async () => {
      const researchAgent = new Agent({
        name: 'research-gemini',
        instructions: 'You perform research tasks',
        model: google('gemini-2.5-flash-lite'),
      });

      const analysisAgent = new Agent({
        name: 'analysis-gemini',
        instructions: 'You analyze research data',
        model: google('gemini-2.5-flash-lite'),
      });

      const coordinatorAgent = new Agent({
        id: 'coordinator',
        name: 'Coordinator Agent',
        instructions: 'You coordinate between research and analysis agents',
        model: google('gemini-2.5-flash-lite'),
        agents: { researchAgent, analysisAgent },
        memory,
      });

      const stream = await coordinatorAgent.network('Research and analyze the topic of renewable energy', {
        runtimeContext,
        maxSteps: 3,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle network with tools', async () => {
      const calculatorTool = createTool({
        id: 'calculator',
        description: 'Performs basic arithmetic',
        inputSchema: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number(),
          b: z.number(),
        }),
        outputSchema: z.object({
          result: z.number(),
        }),
        execute: async ({ context }) => {
          const { operation, a, b } = context;
          let result = 0;
          switch (operation) {
            case 'add':
              result = a + b;
              break;
            case 'subtract':
              result = a - b;
              break;
            case 'multiply':
              result = a * b;
              break;
            case 'divide':
              result = b !== 0 ? a / b : 0;
              break;
          }
          return { result };
        },
      });

      const mathAgent = new Agent({
        id: 'math-agent',
        name: 'Math Agent',
        instructions: 'You can perform calculations using the calculator tool',
        model: google('gemini-2.5-flash-lite'),
        tools: { calculatorTool },
        memory,
      });

      const stream = await mathAgent.network('Calculate 25 * 4', {
        runtimeContext,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle network with workflows', async () => {
      const processAgent = new Agent({
        name: 'process-agent',
        instructions: 'You process text data',
        model: google('gemini-2.5-flash-lite'),
      });

      const processStep = createStep({
        id: 'process-step',
        description: 'Process text data',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ processedText: z.string() }),
        execute: async ({ inputData }) => {
          const resp = await processAgent.generate(`Process this text: ${inputData.text}`, {
            output: z.object({ processedText: z.string() }),
          });
          return { processedText: resp.object.processedText };
        },
      });

      const textWorkflow = createWorkflow({
        id: 'text-workflow',
        description: 'Workflow for processing text',
        steps: [],
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ processedText: z.string() }),
      })
        .then(processStep)
        .commit();

      const workflowAgent = new Agent({
        id: 'workflow-agent',
        name: 'Workflow Agent',
        instructions: 'You coordinate text processing workflows',
        model: google('gemini-2.5-flash-lite'),
        workflows: { textWorkflow },
        memory,
      });

      const stream = await workflowAgent.network('Execute text-workflow with text: "Hello World"', {
        runtimeContext,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases for Gemini message ordering', () => {
    it('should handle system-only context with empty user message', async () => {
      const systemOnlyAgent = new Agent({
        id: 'system-only-gemini',
        name: 'System Only Gemini',
        instructions: 'You are an expert on marine biology. You always respond with scientific facts.',
        model: google('gemini-2.5-flash-lite'),
      });

      const result = await systemOnlyAgent.generate('', {
        system: 'Always be scientific and accurate',
      });

      expect(result).toBeDefined();
    });

    it('should handle empty input gracefully', async () => {
      const agent = new Agent({
        id: 'empty-input-agent',
        name: 'Empty Input Agent',
        instructions: 'You handle empty inputs',
        model: google('gemini-2.5-flash-lite'),
        memory,
      });

      const stream = await agent.network('', {
        runtimeContext,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
    });

    it('should handle multiple consecutive network calls', async () => {
      const agent = new Agent({
        id: 'multi-call-agent',
        name: 'Multi Call Agent',
        instructions: 'You handle multiple interactions',
        model: google('gemini-2.5-flash-lite'),
        memory,
      });

      const threadId = 'multi-thread';
      const resourceId = 'multi-resource';

      // Multiple calls that build context
      const inputs = ['Remember the number 42', 'What number did I ask you to remember?', 'Add 10 to that number'];

      for (const input of inputs) {
        const stream = await agent.network(input, {
          runtimeContext,
          memory: {
            thread: threadId,
            resource: resourceId,
          },
        });

        const chunks: ChunkType[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }

        expect(chunks).toBeDefined();
      }
    });

    it('should handle complex agent network scenario', async () => {
      // Create a more realistic agent network
      const dataAgent = new Agent({
        name: 'data-agent',
        instructions: 'You retrieve and format data',
        model: google('gemini-2.5-flash-lite'),
      });

      const validationAgent = new Agent({
        name: 'validation-agent',
        instructions: 'You validate data quality',
        model: google('gemini-2.5-flash-lite'),
      });

      const reportAgent = new Agent({
        name: 'report-agent',
        instructions: 'You create reports from validated data',
        model: google('gemini-2.5-flash-lite'),
      });

      const orchestratorAgent = new Agent({
        id: 'orchestrator',
        name: 'Orchestrator Agent',
        instructions: 'You orchestrate data processing pipeline: retrieve, validate, then report',
        model: google('gemini-2.5-flash-lite'),
        agents: { dataAgent, validationAgent, reportAgent },
        memory,
      });

      const stream = await orchestratorAgent.network('Process data about climate change and create a report', {
        runtimeContext,
        maxSteps: 4,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
}, 120e3);
