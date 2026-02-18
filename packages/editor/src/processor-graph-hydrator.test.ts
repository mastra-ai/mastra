import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Processor, ProcessorWorkflow } from '@mastra/core/processors';
import { isProcessorWorkflow } from '@mastra/core/processors';
import type { ProcessorProvider, ProcessorPhase } from '@mastra/core/processor-provider';
import type {
  StoredProcessorGraph,
  ProcessorGraphStep,
  ProcessorGraphEntry,
  ProcessorGraphCondition,
  StorageConditionalVariant,
} from '@mastra/core/storage';
import { hydrateProcessorGraph, selectFirstMatchingGraph } from './processor-graph-hydrator';
import { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { TextPart } from '@mastra/core/_types/@internal_ai-sdk-v4/dist';
import { Mastra } from '@mastra/core';
import { IMastraLogger } from '@mastra/core/logger';

// ---------------------------------------------------------------------------
// Test helpers — mock ProcessorProviders
// ---------------------------------------------------------------------------

function makeInputProvider(id: string, tag: string): ProcessorProvider {
  return {
    info: { id, name: `${id} Provider` },
    configSchema: z.object({ tag: z.string().optional() }),
    availablePhases: ['processInput'] as ProcessorPhase[],
    createProcessor(config: Record<string, unknown>): Processor {
      return {
        id: `${id}-instance`,
        name: `${id} Instance`,
        processInput: async ({ messages }) =>
          messages.map((m: MastraDBMessage) => ({
            ...m,
            content: {
              ...m.content,
              parts: m.content.parts.map(p =>
                p.type === 'text' ? { ...p, text: `[${(config.tag as string) ?? tag}] ${p.text}` } : p,
              ),
            },
          })),
      };
    },
  };
}

function makeOutputProvider(id: string, suffix: string): ProcessorProvider {
  return {
    info: { id, name: `${id} Provider` },
    configSchema: z.object({ suffix: z.string().optional() }),
    availablePhases: ['processOutputResult'] as ProcessorPhase[],
    createProcessor(config: Record<string, unknown>): Processor {
      return {
        id: `${id}-instance`,
        name: `${id} Instance`,
        processOutputResult: async ({ messages }) =>
          messages.map(m => ({
            ...m,
            content: {
              ...m.content,
              parts: m.content.parts.map(p => ({
                ...p,
                text: `${(p as TextPart).text}${(config.suffix as string) ?? suffix}`,
              })),
            },
          })),
      };
    },
  };
}

/** A provider that implements both input AND output phases. */
function makeDualProvider(id: string): ProcessorProvider {
  return {
    info: { id, name: `${id} Provider` },
    configSchema: z.object({}),
    availablePhases: ['processInput', 'processOutputResult'] as ProcessorPhase[],
    createProcessor(): Processor {
      return {
        id: `${id}-instance`,
        name: `${id} Instance`,
        processInput: async ({ messages }) => messages,
        processOutputResult: async ({ messages }) => messages,
      };
    },
  };
}

function makeMsg(text: string) {
  return {
    id: crypto.randomUUID(),
    role: 'user' as const,
    content: { format: 2 as const, parts: [{ type: 'text' as const, text }] },
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectFirstMatchingGraph', () => {
  it('should return the first variant whose rules match the context', () => {
    const graphA: StoredProcessorGraph = {
      steps: [{ type: 'step', step: { id: 'a', providerId: 'p', config: {}, enabledPhases: ['processInput'] } }],
    };
    const graphB: StoredProcessorGraph = {
      steps: [{ type: 'step', step: { id: 'b', providerId: 'p', config: {}, enabledPhases: ['processInput'] } }],
    };

    const variants: StorageConditionalVariant<StoredProcessorGraph>[] = [
      {
        value: graphA,
        rules: {
          operator: 'AND',
          conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
        },
      },
      {
        value: graphB,
        // No rules = unconditional fallback
      },
    ];

    // Admin context → graphA
    expect(selectFirstMatchingGraph(variants, { role: 'admin' })).toBe(graphA);

    // Non-admin context → graphB (fallback)
    expect(selectFirstMatchingGraph(variants, { role: 'user' })).toBe(graphB);
  });

  it('should return undefined when no variant matches', () => {
    const graph: StoredProcessorGraph = {
      steps: [{ type: 'step', step: { id: 'a', providerId: 'p', config: {}, enabledPhases: ['processInput'] } }],
    };

    const variants: StorageConditionalVariant<StoredProcessorGraph>[] = [
      {
        value: graph,
        rules: {
          operator: 'AND',
          conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
        },
      },
    ];

    expect(selectFirstMatchingGraph(variants, { role: 'user' })).toBeUndefined();
  });
});

describe('hydrateProcessorGraph', () => {
  describe('empty / undefined input', () => {
    it('should return undefined for undefined graph', () => {
      const result = hydrateProcessorGraph(undefined, 'input', { providers: {} });
      expect(result).toBeUndefined();
    });

    it('should return undefined for an empty steps array', () => {
      const result = hydrateProcessorGraph({ steps: [] }, 'input', { providers: {} });
      expect(result).toBeUndefined();
    });
  });

  describe('missing provider', () => {
    it('should skip steps whose provider is not found and log a warning', () => {
      const warnSpy = vi.fn();
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'nonexistent', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: {},
        logger: { warn: warnSpy } as unknown as IMastraLogger,
      });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
      expect(result).toBeUndefined();
    });
  });

  describe('sequential graph — input mode', () => {
    it('should hydrate a single-step sequential graph into a flat processor array', () => {
      const provider = makeInputProvider('normalizer', 'NORM');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'step-1',
              providerId: 'normalizer',
              config: { tag: 'X' },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: { normalizer: provider },
      });

      expect(result).toBeDefined();
      expect(result!.length).toBe(1);
      // Should be a plain processor, NOT a workflow
      const proc = result![0]!;
      expect(isProcessorWorkflow(proc)).toBe(false);
      expect((proc as Processor).processInput).toBeDefined();
    });

    it('should hydrate and run multiple sequential input processors, passing messages through', async () => {
      const providerA = makeInputProvider('tag-a', 'A');
      const providerB = makeInputProvider('tag-b', 'B');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'tag-a', config: {}, enabledPhases: ['processInput'] },
          },
          {
            type: 'step',
            step: { id: 's2', providerId: 'tag-b', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      const processors: Processor[] = hydrateProcessorGraph(graph, 'input', {
        providers: { 'tag-a': providerA, 'tag-b': providerB },
      })!;

      expect(processors.length).toBe(2);

      // Run them in sequence, simulating what the ProcessorRunner does
      let messages: MastraDBMessage[] = [makeMsg('hello')];
      for (const proc of processors) {
        const result = await proc.processInput!({
          messages,
          abort: () => {
            throw new Error('abort');
          },
          messageList: new MessageList(),
          systemMessages: [],
          state: {},
          retryCount: 0,
        });
        if (result instanceof MessageList) {
          messages = result.get.all.db();
        } else {
          if ('messages' in result) {
            messages = result.messages;
          } else {
            messages = result;
          }
        }
      }

      // After processor A: "[A] hello", after processor B: "[B] [A] hello"
      const text = messages[0]!.content.parts[0]!.type === 'text' ? messages[0]!.content.parts[0]!.text : '';
      expect(text).toBe('[B] [A] hello');
    });
  });

  describe('sequential graph — output mode', () => {
    it('should filter out input-only processors in output mode', () => {
      const provider = makeInputProvider('input-only', 'I');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'input-only', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      // Hydrate in output mode — the processor only has processInput, not output methods
      const result = hydrateProcessorGraph(graph, 'output', {
        providers: { 'input-only': provider },
      });

      expect(result).toBeUndefined();
    });

    it('should hydrate output processors correctly', async () => {
      const provider = makeOutputProvider('suffixer', '!');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 's1',
              providerId: 'suffixer',
              config: { suffix: '-done' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      const processors = hydrateProcessorGraph(graph, 'output', {
        providers: { suffixer: provider },
      })!;

      expect(processors.length).toBe(1);
      const proc = processors[0] as Processor;
      expect(proc.processOutputResult).toBeDefined();

      const result = await proc.processOutputResult!({
        messages: [makeMsg('response')],
        messageList: new MessageList(),
        state: {},
        retryCount: 0,
        abort: () => {
          throw new Error('abort');
        },
      });
      if (result instanceof MessageList) {
        const text = (result.get.response.db()[0]!.content.parts[0] as TextPart).text;
        expect(text).toBe('response-done');
      } else {
        const text = (result[0]!.content.parts[0] as TextPart).text;
        expect(text).toBe('response-done');
      }
    });
  });

  describe('phase filtering', () => {
    it('should only expose enabled phases when a dual-phase provider is used', () => {
      const provider = makeDualProvider('dual');

      // Enable only processInput, disable processOutputResult
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'dual', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: { dual: provider },
      })!;

      expect(result.length).toBe(1);
      const proc = result[0] as Processor;
      expect(proc.processInput).toBeDefined();
      // processOutputResult should have been filtered out by PhaseFilteredProcessor
      expect(proc.processOutputResult).toBeUndefined();
    });
  });

  describe('complex graph — workflow construction', () => {
    it('should build a ProcessorWorkflow for a graph with parallel branches', () => {
      const providerA = makeInputProvider('pa', 'A');
      const providerB = makeInputProvider('pb', 'B');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'parallel',
            branches: [
              [{ type: 'step', step: { id: 'a', providerId: 'pa', config: {}, enabledPhases: ['processInput'] } }],
              [{ type: 'step', step: { id: 'b', providerId: 'pb', config: {}, enabledPhases: ['processInput'] } }],
            ],
          },
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: { pa: providerA, pb: providerB },
      })!;

      expect(result.length).toBe(1);
      expect(isProcessorWorkflow(result[0])).toBe(true);
    });

    it('should build a ProcessorWorkflow for a graph with conditional branches', () => {
      const providerA = makeInputProvider('ca', 'A');
      const providerB = makeInputProvider('cb', 'B');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'conditional',
            conditions: [
              {
                rules: {
                  operator: 'AND',
                  conditions: [{ field: 'phase', operator: 'equals', value: 'processInput' }],
                },
                steps: [
                  { type: 'step', step: { id: 'a', providerId: 'ca', config: {}, enabledPhases: ['processInput'] } },
                ],
              },
              {
                // Default branch (no rules)
                steps: [
                  { type: 'step', step: { id: 'b', providerId: 'cb', config: {}, enabledPhases: ['processInput'] } },
                ],
              },
            ],
          } as ProcessorGraphEntry,
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: { ca: providerA, cb: providerB },
      })!;

      expect(result.length).toBe(1);
      expect(isProcessorWorkflow(result[0])).toBe(true);
    });

    it('should build a workflow for a mixed sequential + parallel graph', () => {
      const pA = makeInputProvider('first', 'FIRST');
      const pB = makeInputProvider('branch-a', 'BA');
      const pC = makeInputProvider('branch-b', 'BB');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'step-1', providerId: 'first', config: {}, enabledPhases: ['processInput'] },
          },
          {
            type: 'parallel',
            branches: [
              [
                {
                  type: 'step',
                  step: { id: 'ba', providerId: 'branch-a', config: {}, enabledPhases: ['processInput'] },
                },
              ],
              [
                {
                  type: 'step',
                  step: { id: 'bb', providerId: 'branch-b', config: {}, enabledPhases: ['processInput'] },
                },
              ],
            ],
          },
        ],
      };

      const result = hydrateProcessorGraph(graph, 'input', {
        providers: { first: pA, 'branch-a': pB, 'branch-b': pC },
      })!;

      // Has parallel entries, so it should be wrapped in a workflow
      expect(result.length).toBe(1);
      expect(isProcessorWorkflow(result[0])).toBe(true);
    });
  });

  describe('config passthrough', () => {
    it('should pass config to the provider createProcessor', async () => {
      const createSpy = vi.fn().mockReturnValue({
        id: 'spy-instance',
        processInput: async ({ messages }) => messages,
      });

      const provider: ProcessorProvider = {
        info: { id: 'spy-provider', name: 'Spy' },
        configSchema: z.object({ threshold: z.number() }),
        availablePhases: ['processInput'],
        createProcessor: createSpy,
      };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 's1',
              providerId: 'spy-provider',
              config: { threshold: 0.8 },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      hydrateProcessorGraph(graph, 'input', {
        providers: { 'spy-provider': provider },
      });

      expect(createSpy).toHaveBeenCalledWith({ threshold: 0.8 });
    });
  });

  describe('__registerMastra propagation', () => {
    it('should call __registerMastra on the created processor if mastra is provided', () => {
      const registerSpy = vi.fn();
      const provider: ProcessorProvider = {
        info: { id: 'reg-provider', name: 'Reg' },
        configSchema: z.object({}),
        availablePhases: ['processInput'],
        createProcessor: () => ({
          id: 'reg-instance',
          processInput: async ({ messages }) => messages,
          __registerMastra: registerSpy,
        }),
      };

      const fakeMastra = { isFake: true };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'reg-provider', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      hydrateProcessorGraph(graph, 'input', {
        providers: { 'reg-provider': provider },
        mastra: fakeMastra as unknown as Mastra,
      });

      expect(registerSpy).toHaveBeenCalledWith(fakeMastra);
    });
  });

  describe('Workflow execution smoke tests', () => {
    it('should produce valid ProcessorStepOutput from a conditional workflow', async () => {
      const branchACalled = vi.fn();

      const providerA: ProcessorProvider = {
        info: { id: 'prov-a', name: 'A' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'a-instance',
            name: 'A',
            processInput: async ({ messages }) => {
              branchACalled();
              return messages;
            },
          };
        },
      };

      const providerB: ProcessorProvider = {
        info: { id: 'prov-b', name: 'B' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'b-instance',
            name: 'B',
            processInput: async ({ messages }) => messages,
          };
        },
      };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'conditional',
            conditions: [
              {
                rules: {
                  operator: 'AND' as const,
                  conditions: [{ field: 'phase', operator: 'equals' as const, value: 'input' }],
                },
                steps: [
                  {
                    type: 'step',
                    step: { id: 'ca', providerId: 'prov-a', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
              {
                rules: {
                  operator: 'AND' as const,
                  conditions: [{ field: 'phase', operator: 'equals' as const, value: 'outputResult' }],
                },
                steps: [
                  {
                    type: 'step',
                    step: { id: 'cb', providerId: 'prov-b', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
            ],
          },
        ],
      };

      const providers = { 'prov-a': providerA, 'prov-b': providerB };
      const result = hydrateProcessorGraph(graph, 'input', { providers });
      expect(result).toHaveLength(1);

      const workflow = result![0]! as ProcessorWorkflow;
      expect(isProcessorWorkflow(workflow)).toBe(true);

      // Execute the workflow directly with raw messages (no MessageList)
      const messages: MastraDBMessage[] = [
        {
          id: 'test-msg-1',
          role: 'user' as const,
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text' as const, text: 'Hello' }] },
        },
      ];
      const ml = new MessageList();
      ml.add(messages, 'input');

      const run = await workflow.createRun();
      const runResult = await run.start({
        inputData: {
          phase: 'input',
          messages,
          messageList: ml,
        },
      });

      if (runResult.status !== 'success') {
        throw new Error(`Workflow failed with status: ${runResult.status}`);
      }

      expect(runResult.status).toBe('success');
      console.log('[runResult]', runResult);
      // The result should be a valid ProcessorStepOutput (flat, with 'phase')
      expect(runResult.result).toBeDefined();
      expect(runResult.result.phase).toBe('input');
      expect(branchACalled).toHaveBeenCalled();
    }, 10000);

    it('should produce valid ProcessorStepOutput from a conditional workflow with default branch', async () => {
      const defaultCalled = vi.fn();

      const provDefault: ProcessorProvider = {
        info: { id: 'prov-default', name: 'Default' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'default-instance',
            name: 'Default',
            processInput: async ({ messages }) => {
              defaultCalled();
              return messages;
            },
          };
        },
      };

      const provNever: ProcessorProvider = {
        info: { id: 'prov-never', name: 'Never' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'never-instance',
            name: 'Never',
            processInput: async ({ messages }) => messages,
          };
        },
      };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'conditional',
            conditions: [
              {
                rules: {
                  operator: 'AND' as const,
                  conditions: [{ field: 'phase', operator: 'equals' as const, value: 'nonexistent' }],
                },
                steps: [
                  {
                    type: 'step',
                    step: { id: 'cn', providerId: 'prov-never', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
              {
                // Default branch (no rules)
                steps: [
                  {
                    type: 'step',
                    step: { id: 'cd', providerId: 'prov-default', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
            ],
          },
        ],
      };

      const providers = { 'prov-never': provNever, 'prov-default': provDefault };
      const result = hydrateProcessorGraph(graph, 'input', { providers });
      expect(result).toHaveLength(1);

      const workflow = result![0]! as ProcessorWorkflow;
      expect(isProcessorWorkflow(workflow)).toBe(true);

      const messages: MastraDBMessage[] = [
        {
          id: 'test-msg-1',
          role: 'user' as const,
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text' as const, text: 'Hello' }] },
        },
      ];
      const ml = new MessageList();
      ml.add(messages, 'input');

      const run = await workflow.createRun();
      const runResult = await run.start({
        inputData: {
          phase: 'input',
          messages,
          messageList: ml,
        },
      });

      if (runResult.status !== 'success') {
        throw new Error(`Workflow failed with status: ${runResult.status}`);
      }

      expect(runResult.status).toBe('success');
      expect(runResult.result).toBeDefined();
      expect(runResult.result.phase).toBe('input');
      expect(defaultCalled).toHaveBeenCalled();
    }, 10000);
  });
});
