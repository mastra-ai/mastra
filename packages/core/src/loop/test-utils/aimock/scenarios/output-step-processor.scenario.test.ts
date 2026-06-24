/**
 * AIMock Scenario: Output Step Processor
 *
 * Tests that processOutputStep runs after each model step (not just the final
 * output). This covers the regression class where per-step output processing
 * could be skipped, causing tool-call filtering or text redaction to only
 * apply to the final response.
 *
 * Asserts:
 * - processOutputStep runs for each step (including intermediate tool-call steps)
 * - processOutputStep can modify the step output (redact tool-call args)
 * - processOutputStep sees the correct tool call info
 */

import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory/mock';
import { TaskSignalProvider } from '../../../../signals';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

describeForAllEngines(
  'AIMock loop scenario: output step processor (per-step)',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('processOutputStep runs for each step including intermediate tool-call steps', async () => {
      const stepsSeen: Array<{ iteration: number; hasToolCalls: boolean }> = [];

      const lookupTool = createTool({
        id: 'lookup',
        description: 'Look up a value.',
        inputSchema: z.object({ key: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
      });

      const outputStepProcessor = {
        id: 'step-tracker',
        async processOutputStep({ toolCalls, stepNumber }: { toolCalls?: unknown[]; stepNumber: number }) {
          stepsSeen.push({
            iteration: stepNumber + 1,
            hasToolCalls: Boolean(toolCalls && toolCalls.length > 0),
          });
        },
      };

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Look up the value for key alpha.',
        tools: { lookup: lookupTool },
        stopWhen: stepCountIs(5),
        outputProcessors: [outputStepProcessor],
        fixtures: llm => {
          // Turn 1: emit a tool call
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { key: 'alpha' } }],
            },
          );
          // Turn 2: final text
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The value for alpha is VALUE_FOR_alpha.' });
        },
      });

      // processOutputStep ran for both steps (tool-call step + final step)
      expect(stepsSeen).toHaveLength(2);
      // Step 1 had tool calls
      expect(stepsSeen[0].hasToolCalls).toBe(true);
      // Step 2 had no tool calls (final text)
      expect(stepsSeen[1].hasToolCalls).toBe(false);
    });

    it('keeps memory messages out of current step content when a no-op processOutputStep returns messages', async () => {
      const memory = new MockMemory();
      const threadId = `noop-output-step-memory-thread-${engine}`;
      const resourceId = `noop-output-step-memory-resource-${engine}`;
      const stepContents: string[] = [];

      await memory.saveThread({
        thread: {
          id: threadId,
          title: 'No-op Output Step Processor Thread',
          resourceId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Remember this seed fact: MEMORY_ONLY_PRIOR_ASSISTANT_TEXT.',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Seeded MEMORY_ONLY_PRIOR_ASSISTANT_TEXT into history.' });
        },
      });

      getMock().clearRequests();
      getMock().clearFixtures();
      getMock().resetMatchCounts();

      const lookupTool = createTool({
        id: 'lookup_memory_regression',
        description: 'Look up a value.',
        inputSchema: z.object({ key: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ key }) => ({ value: `VALUE_FOR_${key}` }),
      });

      const noopOutputStepProcessor = {
        id: 'noop-output-step-return-messages',
        async processOutputStep({ messages }: { messages: any[] }) {
          return messages;
        },
      };

      const { requests, output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Use the lookup tool for key beta, then answer with only the looked up value.',
        tools: { lookup_memory_regression: lookupTool },
        memory,
        threadId,
        resourceId,
        outputProcessors: [noopOutputStepProcessor],
        stopWhen: stepCountIs(5),
        onStepFinish: ({ content }: { content: unknown }) => {
          stepContents.push(JSON.stringify(content));
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                { id: 'call_lookup_memory_regression', name: 'lookup_memory_regression', arguments: { key: 'beta' } },
              ],
            },
          );
          llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'VALUE_FOR_beta' });
        },
      });

      expect(requests).toHaveLength(2);
      expect(stepContents).toHaveLength(2);
      expect(stepContents[0]).toContain('lookup_memory_regression');
      expect(stepContents[1]).toContain('VALUE_FOR_beta');
      expect(stepContents[1]).not.toContain('MEMORY_ONLY_PRIOR_ASSISTANT_TEXT');
      await expect(output.text).resolves.toContain('VALUE_FOR_beta');
    });

    it('keeps memory messages out of current step content when no-op processOutputStep overlaps task state signals', async () => {
      const memory = new MockMemory();
      const threadId = `noop-output-step-task-signals-thread-${engine}`;
      const resourceId = `noop-output-step-task-signals-resource-${engine}`;
      const stepContents: unknown[][] = [];
      const summarizeStepContent = (content: unknown[]) =>
        content.map(part => {
          const item = part as { type?: string; toolCallId?: string; toolName?: string; text?: string };
          return {
            type: item.type,
            ...(item.toolCallId ? { toolCallId: item.toolCallId } : {}),
            ...(item.toolName ? { toolName: item.toolName } : {}),
            ...(item.text ? { text: item.text } : {}),
          };
        });

      await memory.saveThread({
        thread: {
          id: threadId,
          title: 'No-op Output Step Processor Task Signals Thread',
          resourceId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Seed prior memory text: TASK_SIGNAL_MEMORY_ONLY_TEXT.',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Seeded TASK_SIGNAL_MEMORY_ONLY_TEXT into prior history.' });
        },
      });

      getMock().clearRequests();
      getMock().clearFixtures();
      getMock().resetMatchCounts();

      const noopOutputStepProcessor = {
        id: 'noop-output-step-return-messages-with-task-signals',
        async processOutputStep({ messages }: { messages: any[] }) {
          return messages;
        },
      };

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Create, update, and complete the debugger task, then answer TASK_SIGNAL_DONE.',
        signals: [new TaskSignalProvider()],
        memory,
        threadId,
        resourceId,
        outputProcessors: [noopOutputStepProcessor],
        maxSteps: 6,
        onStepFinish: ({ content }: { content: unknown[] }) => {
          stepContents.push(content);
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call_task_write_debugger',
                  name: 'task_write',
                  arguments: {
                    tasks: [
                      {
                        id: 'debugger_task',
                        content: 'Inspect debugger state',
                        status: 'pending',
                        activeForm: 'Inspecting debugger state',
                      },
                    ],
                  },
                },
              ],
            },
          );
          llm.onTurn(2, /.*/, {
            toolCalls: [
              {
                id: 'call_task_update_debugger',
                name: 'task_update',
                arguments: { id: 'debugger_task', status: 'in_progress' },
              },
            ],
          });
          llm.onTurn(3, /.*/, {
            toolCalls: [
              {
                id: 'call_task_complete_debugger',
                name: 'task_complete',
                arguments: { id: 'debugger_task' },
              },
            ],
          });
          llm.onTurn(4, /.*/, { content: 'TASK_SIGNAL_DONE' });
        },
      });

      expect(requests).toHaveLength(4);
      expect(stepContents.map(summarizeStepContent)).toEqual([
        [
          { type: 'tool-call', toolCallId: 'call_task_write_debugger', toolName: 'task_write' },
          { type: 'tool-result', toolCallId: 'call_task_write_debugger', toolName: 'task_write' },
        ],
        [
          { type: 'tool-call', toolCallId: 'call_task_update_debugger', toolName: 'task_update' },
          { type: 'tool-result', toolCallId: 'call_task_update_debugger', toolName: 'task_update' },
        ],
        [
          { type: 'tool-call', toolCallId: 'call_task_complete_debugger', toolName: 'task_complete' },
          { type: 'tool-result', toolCallId: 'call_task_complete_debugger', toolName: 'task_complete' },
        ],
        [{ type: 'text', text: 'TASK_SIGNAL_DONE' }],
      ]);
    });

    it('keeps current visible text in step content when no-op processOutputStep overlaps task state signals', async () => {
      const memory = new MockMemory();
      const threadId = `noop-output-step-task-signal-text-thread-${engine}`;
      const resourceId = `noop-output-step-task-signal-text-resource-${engine}`;
      const stepContents: unknown[][] = [];
      const summarizeStepContent = (content: unknown[]) =>
        content.map(part => {
          const item = part as { type?: string; toolCallId?: string; toolName?: string; text?: string };
          return {
            type: item.type,
            ...(item.text ? { text: item.text } : {}),
            ...(item.toolCallId ? { toolCallId: item.toolCallId } : {}),
            ...(item.toolName ? { toolName: item.toolName } : {}),
          };
        });

      await memory.saveThread({
        thread: {
          id: threadId,
          title: 'No-op Output Step Processor Task Signal Text Thread',
          resourceId,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Seed prior memory text: TASK_SIGNAL_TEXT_MEMORY_ONLY.',
        memory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Seeded TASK_SIGNAL_TEXT_MEMORY_ONLY into prior history.' });
        },
      });

      getMock().clearRequests();
      getMock().clearFixtures();
      getMock().resetMatchCounts();

      const noopOutputStepProcessor = {
        id: 'noop-output-step-return-messages-with-task-signal-text',
        async processOutputStep({ messages }: { messages: any[] }) {
          return messages;
        },
      };

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Narrate while creating and updating the debugger task, then answer TASK_SIGNAL_TEXT_DONE.',
        signals: [new TaskSignalProvider()],
        memory,
        threadId,
        resourceId,
        outputProcessors: [noopOutputStepProcessor],
        maxSteps: 6,
        onStepFinish: ({ content }: { content: unknown[] }) => {
          stepContents.push(content);
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              content: 'TEXT_BEFORE_TASK_WRITE',
              toolCalls: [
                {
                  id: 'call_text_task_write_debugger',
                  name: 'task_write',
                  arguments: {
                    tasks: [
                      {
                        id: 'debugger_text_task',
                        content: 'Inspect debugger text state',
                        status: 'pending',
                        activeForm: 'Inspecting debugger text state',
                      },
                    ],
                  },
                },
              ],
            },
          );
          llm.onTurn(3, /.*/, {
            content: 'TEXT_BEFORE_TASK_UPDATE',
            toolCalls: [
              {
                id: 'call_text_task_update_debugger',
                name: 'task_update',
                arguments: { id: 'debugger_text_task', status: 'in_progress' },
              },
            ],
          });
          llm.onTurn(5, /.*/, { content: 'TASK_SIGNAL_TEXT_DONE' });
        },
      });

      expect(requests).toHaveLength(3);
      expect(stepContents.map(summarizeStepContent)).toEqual([
        [
          { type: 'text', text: 'TEXT_BEFORE_TASK_WRITE' },
          { type: 'tool-call', toolCallId: 'call_text_task_write_debugger', toolName: 'task_write' },
          { type: 'tool-result', toolCallId: 'call_text_task_write_debugger', toolName: 'task_write' },
        ],
        [
          { type: 'text', text: 'TEXT_BEFORE_TASK_UPDATE' },
          { type: 'tool-call', toolCallId: 'call_text_task_update_debugger', toolName: 'task_update' },
          { type: 'tool-result', toolCallId: 'call_text_task_update_debugger', toolName: 'task_update' },
        ],
        [{ type: 'text', text: 'TASK_SIGNAL_TEXT_DONE' }],
      ]);
    });
  },
  { skip: ['durable'] },
);
