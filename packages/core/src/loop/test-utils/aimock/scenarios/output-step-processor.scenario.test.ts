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
import type { Processor } from '../../../../processors';
import { TaskSignalProvider } from '../../../../signals';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines, anyToolResult } from '../aimock-scenario';

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
            { endpoint: 'chat', predicate: req => !anyToolResult(req) },
            {
              toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: { key: 'alpha' } }],
            },
          );
          // Turn 2: final text
          llm.on(
            { endpoint: 'chat', predicate: anyToolResult },
            { content: 'The value for alpha is VALUE_FOR_alpha.' },
          );
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
            { endpoint: 'chat', predicate: req => !anyToolResult(req) },
            {
              toolCalls: [
                { id: 'call_lookup_memory_regression', name: 'lookup_memory_regression', arguments: { key: 'beta' } },
              ],
            },
          );
          llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'VALUE_FOR_beta' });
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
            { endpoint: 'chat', predicate: req => !anyToolResult(req) },
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
            { endpoint: 'chat', predicate: req => !anyToolResult(req) },
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

    // stopWhen ending the run on a step that has both text and a tool call (#24917). The model
    // writes a sentence, then calls `ask` to hand the turn back to the user; stopWhen stops there.
    const askTool = createTool({
      id: 'ask',
      description: 'Ask the user a question.',
      inputSchema: z.object({ question: z.string() }),
      execute: async () => ({ answered: true }),
    });
    const noteTool = createTool({
      id: 'note',
      description: 'Write an internal note.',
      inputSchema: z.object({ question: z.string() }),
      execute: async () => ({}),
    });
    const askCall = { id: 'call_ask', name: 'ask', arguments: { question: 'ok?' } };
    const stopOnAsk = ({ steps }: { steps: any[] }) =>
      steps.at(-1)?.toolCalls?.some((c: any) => (c.toolName ?? c.payload?.toolName) === 'ask') ?? false;
    const passThrough: Processor = { id: 'pass-through', processOutputStream: async ({ part }) => part };
    const streamedText = (chunks: { type: string; payload?: any }[] | undefined) =>
      (chunks ?? [])
        .filter(c => c.type === 'text-delta')
        .map(c => c.payload.text)
        .join('');

    // Technical: with an output processor, a final step holding text + a tool call used to lose
    // its text from stream.text and steps[].text once stopWhen ended the run (#24917).
    for (const withProcessor of [false, true]) {
      it(`a question asked alongside a sentence keeps the sentence (processor: ${withProcessor})`, async () => {
        const { output, chunks } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'hi',
          tools: { ask: askTool },
          stopWhen: stopOnAsk as any,
          collectChunks: true,
          ...(withProcessor ? { outputProcessors: [passThrough] } : {}),
          fixtures: llm => {
            llm.on({ endpoint: 'chat' }, { content: 'Hello there.', toolCalls: [askCall] });
          },
        });

        const steps = await output.steps;
        expect(streamedText(chunks)).toBe('Hello there.');
        expect(steps).toHaveLength(1);
        expect(steps.at(-1)!.text).toBe('Hello there.');
        expect(await output.text).toBe('Hello there.');
      });

      // Technical: when the final step is tool-only, text from an earlier step must not be
      // reported as the final step's text or the run text.
      it(`a question asked without a sentence reports no text (processor: ${withProcessor})`, async () => {
        const { output } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'hi',
          tools: { ask: askTool, note: noteTool },
          stopWhen: stopOnAsk as any,
          ...(withProcessor ? { outputProcessors: [passThrough] } : {}),
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', predicate: req => !anyToolResult(req) },
              {
                content: 'Let me check.',
                toolCalls: [{ id: 'call_note', name: 'note', arguments: { question: 'x' } }],
              },
            );
            llm.on({ endpoint: 'chat', predicate: anyToolResult }, { toolCalls: [askCall] });
          },
        });

        const steps = await output.steps;
        expect(steps).toHaveLength(2);
        expect(steps.at(-1)!.text).toBe('');
        expect(await output.text).toBe('');
      });
    }

    // Technical: a processOutputStream rewrite of text-delta on a text + tool-call final step is
    // what steps[].text and output.text report, not the raw model text.
    for (const [label, rewrite] of [
      ['redacts', '[REDACTED]'],
      ['clears', ''],
    ] as const) {
      it(`a sentence the processor ${label} before a question is reported as processed`, async () => {
        const redact: Processor = {
          id: 'redact',
          processOutputStream: async ({ part }) =>
            part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: rewrite } } : part,
        };
        const { output } = await runLoopScenario({
          engine,
          llm: getMock(),
          prompt: 'hi',
          tools: { ask: askTool },
          stopWhen: stopOnAsk as any,
          outputProcessors: [redact],
          fixtures: llm => {
            llm.on({ endpoint: 'chat' }, { content: 'SECRET', toolCalls: [askCall] });
          },
        });

        expect((await output.steps).at(-1)!.text).toBe(rewrite);
        expect(await output.text).toBe(rewrite);
      });
    }

    // Technical: processOutputResult edits to an earlier step must be what onFinish receives,
    // even when stopWhen ends the run on a later tool-only step.
    it('onFinish gets the redacted sentence when the run stops on a question', async () => {
      const redactFinish: Processor = {
        id: 'redact-finish-messages',
        processOutputResult: async ({ messages }) =>
          messages.map(message => ({
            ...message,
            content: {
              ...message.content,
              parts: message.content.parts?.map(part =>
                part.type === 'text' ? { ...part, text: part.text.replace('SECRET', '[r]') } : part,
              ),
            },
          })),
      };
      let finishMessages: unknown;

      await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'hi',
        tools: { ask: askTool, note: noteTool },
        stopWhen: stopOnAsk as any,
        outputProcessors: [redactFinish],
        onFinish: async ({ messages }: { messages: unknown }) => {
          finishMessages = messages;
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', predicate: req => !anyToolResult(req) },
            { content: 'SECRET ', toolCalls: [{ id: 'call_note', name: 'note', arguments: { question: 'x' } }] },
          );
          llm.on({ endpoint: 'chat', predicate: anyToolResult }, { toolCalls: [askCall] });
        },
      });

      expect(JSON.stringify(finishMessages)).toContain('[r]');
      expect(JSON.stringify(finishMessages)).not.toContain('SECRET');
    });

    // #26346: feedback continuation must not duplicate earlier text during result processing.
    // Technical: processOutputResult rewrites appear on their own steps, not only the last step.
    // Known gap: durable, evented and inngest engines report the raw step text ('firstmore') because the
    // processOutputResult rewrite is not reconciled back onto steps after a feedback continuation.
    const itFailsOnDurable = engine === 'durable' || engine === 'evented' || engine === 'inngest' ? it.fails : it;
    itFailsOnDurable('a reply continued after feedback reports each processed part on its own step', async () => {
      const upper: Processor = {
        id: 'collapse-continuation-result',
        processOutputResult: async ({ messages }) =>
          messages.map(message => {
            if (message.role !== 'assistant' || message.content?.metadata?.completionResult) return message;
            const text = message.content.parts
              ?.map(part => (part.type === 'text' ? part.text.toUpperCase() : ''))
              .join('');
            return { ...message, content: { ...message.content, content: text, parts: [{ type: 'text', text }] } };
          }),
      };
      let iteration = 0;

      const { output } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'hi',
        maxSteps: 2,
        outputProcessors: [upper],
        onIterationComplete: async () =>
          ++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined,
        fixtures: llm => {
          llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'first' });
          llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'more' });
        },
      });

      const full = await output.getFullOutput();
      expect(await output.text).toBe('FIRSTMORE');
      expect(full.text).toBe('FIRSTMORE');
      expect(full.steps.map(step => step.text)).toEqual(['FIRST', 'MORE']);
    });
  },
  {},
);
