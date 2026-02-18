/**
 * Integration tests for Stored Agent + Processor Providers
 *
 * Tests the full flow: StoredProcessorGraph config in DB → MastraEditor hydration
 * → live Agent with correct processors wired up and executing.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { StoredProcessorGraph, StorageConditionalVariant } from '@mastra/core/storage';
import { isProcessorWorkflow } from '@mastra/core/processors';
import type { Processor } from '@mastra/core/processors';
import type { ProcessorProvider, ProcessorPhase } from '@mastra/core/processor-provider';
import { MastraEditor } from './index';
import { hydrateProcessorGraph } from './processor-graph-hydrator';

// ---------------------------------------------------------------------------
// Helper providers — lightweight mock providers for testing
// ---------------------------------------------------------------------------

/**
 * Creates a ProcessorProvider whose processors prepend `[tag]` to every text
 * part of the user's messages (processInput phase).
 */
function makeTaggingInputProvider(providerId: string, defaultTag: string): ProcessorProvider {
  return {
    info: { id: providerId, name: `${providerId} Provider` },
    configSchema: z.object({ tag: z.string().default(defaultTag) }),
    availablePhases: ['processInput'] as ProcessorPhase[],
    createProcessor(config: Record<string, unknown>): Processor {
      const tag = (config.tag as string) ?? defaultTag;
      return {
        id: `${providerId}-instance` as any,
        name: `${providerId} Instance`,
        processInput: async ({ messages }: any) =>
          messages.map((m: any) => ({
            ...m,
            content: {
              ...m.content,
              parts: (m.content?.parts ?? []).map((p: any) =>
                p.type === 'text' ? { ...p, text: `[${tag}] ${p.text}` } : p,
              ),
            },
          })),
      };
    },
  };
}

/**
 * Creates a ProcessorProvider whose processors append a suffix to every text
 * part of assistant messages (processOutputResult phase).
 *
 * processOutputResult receives { messages } and returns the transformed messages.
 */
function makeOutputSuffixProvider(providerId: string, defaultSuffix: string): ProcessorProvider {
  return {
    info: { id: providerId, name: `${providerId} Provider` },
    configSchema: z.object({ suffix: z.string().default(defaultSuffix) }),
    availablePhases: ['processOutputResult'] as ProcessorPhase[],
    createProcessor(config: Record<string, unknown>): Processor {
      const suffix = (config.suffix as string) ?? defaultSuffix;
      return {
        id: `${providerId}-instance` as any,
        name: `${providerId} Instance`,
        processOutputResult: async ({ messages }: any) =>
          messages.map((m: any) => ({
            ...m,
            content: {
              ...m.content,
              parts: (m.content?.parts ?? []).map((p: any) =>
                p.type === 'text' ? { ...p, text: `${p.text}${suffix}` } : p,
              ),
            },
          })),
      };
    },
  };
}

/**
 * Creates a dual-phase ProcessorProvider (processInput + processOutputResult).
 * Used to test phase filtering.
 */
function makeDualPhaseProvider(providerId: string): ProcessorProvider {
  return {
    info: { id: providerId, name: `${providerId} Provider` },
    configSchema: z.object({}),
    availablePhases: ['processInput', 'processOutputResult'] as ProcessorPhase[],
    createProcessor(): Processor {
      return {
        id: `${providerId}-instance` as any,
        name: `${providerId} Instance`,
        processInput: async ({ messages }: any) =>
          messages.map((m: any) => ({
            ...m,
            content: {
              ...m.content,
              parts: (m.content?.parts ?? []).map((p: any) =>
                p.type === 'text' ? { ...p, text: `[DUAL-IN] ${p.text}` } : p,
              ),
            },
          })),
        processOutputResult: async ({ messages }: any) =>
          messages.map((m: any) => ({
            ...m,
            content: {
              ...m.content,
              parts: (m.content?.parts ?? []).map((p: any) =>
                p.type === 'text' ? { ...p, text: `${p.text}[DUAL-OUT]` } : p,
              ),
            },
          })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helper — create stored agent with processor config
// ---------------------------------------------------------------------------

function makeStoredAgentConfig(
  id: string,
  overrides: {
    inputProcessors?: any;
    outputProcessors?: any;
  } = {},
) {
  return {
    id,
    name: `Agent ${id}`,
    instructions: 'You are a test assistant',
    model: { provider: 'openai', name: 'gpt-4' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Stored Agents with Processor Providers', () => {
  describe('Sequential input processors', () => {
    it('should hydrate a single input processor and expose its ID on the agent', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'normalizer-step',
              providerId: 'tagger',
              config: { tag: 'NORM' },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-single-input', {
          inputProcessors: graph,
        }),
      });

      const editor = new MastraEditor({
        processorProviders: { tagger: makeTaggingInputProvider('tagger', 'DEFAULT') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-single-input');
      const { inputProcessorIds, outputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual(['tagger-instance']);
      expect(outputProcessorIds).toEqual([]);
    });

    it('should hydrate multiple chained input processors in order', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'step-a', providerId: 'tagger-a', config: { tag: 'A' }, enabledPhases: ['processInput'] },
          },
          {
            type: 'step',
            step: { id: 'step-b', providerId: 'tagger-b', config: { tag: 'B' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-chained', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          'tagger-a': makeTaggingInputProvider('tagger-a', 'A'),
          'tagger-b': makeTaggingInputProvider('tagger-b', 'B'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-chained');
      const { inputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual(['tagger-a-instance', 'tagger-b-instance']);
    });

    it('should resolve a hydrated processor by ID', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'tagger', config: { tag: 'X' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-resolve-by-id', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: { tagger: makeTaggingInputProvider('tagger', 'X') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-resolve-by-id');
      const proc = await agent!.resolveProcessorById('tagger-instance');

      expect(proc).not.toBeNull();
      expect(proc!.id).toBe('tagger-instance');
      expect(proc!.processInput).toBeDefined();
    });
  });

  describe('Output processor hydration', () => {
    it('should hydrate output processors and expose their IDs', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'suffix-step',
              providerId: 'suffixer',
              config: { suffix: '-processed' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-output', { outputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: { suffixer: makeOutputSuffixProvider('suffixer', '!') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-output');
      const { inputProcessorIds, outputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual([]);
      expect(outputProcessorIds).toEqual(['suffixer-instance']);
    });
  });

  describe('Both input and output processors', () => {
    it('should hydrate both input and output processor graphs independently', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const inputGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'in', providerId: 'tagger', config: { tag: 'IN' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const outputGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'out',
              providerId: 'suffixer',
              config: { suffix: '-OUT' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-both', {
          inputProcessors: inputGraph,
          outputProcessors: outputGraph,
        }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          tagger: makeTaggingInputProvider('tagger', 'DEFAULT'),
          suffixer: makeOutputSuffixProvider('suffixer', '!'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-both');
      const { inputProcessorIds, outputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual(['tagger-instance']);
      expect(outputProcessorIds).toEqual(['suffixer-instance']);
    });
  });

  describe('Phase filtering', () => {
    it('should only expose enabled phases on the hydrated processor', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // Use the dual provider but only enable processInput
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'dual-step',
              providerId: 'dual',
              config: {},
              enabledPhases: ['processInput'], // Only input, not output
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-phase-filter', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: { dual: makeDualPhaseProvider('dual') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-phase-filter');
      const proc = await agent!.resolveProcessorById('dual-instance');

      // processInput should be present (it's enabled)
      expect(proc!.processInput).toBeDefined();
      // processOutputResult should NOT be present (it was filtered out)
      expect(proc!.processOutputResult).toBeUndefined();
    });

    it('should not appear as an output processor when only input phase is enabled', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // A dual-phase provider, but only processInput is enabled.
      // Placed in outputProcessors → should be filtered out because it lacks output methods.
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'dual-step',
              providerId: 'dual',
              config: {},
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-phase-filter-out', { outputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: { dual: makeDualPhaseProvider('dual') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-phase-filter-out');
      const { outputProcessorIds } = await agent!.getConfiguredProcessorIds();

      // Should be empty — the processor only has processInput enabled,
      // and the hydrator filters it out in output mode
      expect(outputProcessorIds).toEqual([]);
    });
  });

  describe('Missing provider — graceful fallback', () => {
    it('should produce an agent with no processors and log a warning when provider is missing', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'missing-step', providerId: 'nonexistent', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-missing-prov', { inputProcessors: graph }),
      });

      const warnSpy = vi.fn();
      const editor = new MastraEditor({
        processorProviders: {},
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-missing-prov');
      const { inputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'));
    });
  });

  describe('No processor config', () => {
    it('should produce an agent with empty processor arrays when no processor fields are set', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-no-proc'),
      });

      const editor = new MastraEditor({
        processorProviders: { tagger: makeTaggingInputProvider('tagger', 'X') },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-no-proc');
      const { inputProcessorIds, outputProcessorIds } = await agent!.getConfiguredProcessorIds();

      expect(inputProcessorIds).toEqual([]);
      expect(outputProcessorIds).toEqual([]);
    });
  });

  describe('Conditional processor variants', () => {
    it('should resolve different processor graphs based on request context', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const adminGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'admin-s',
              providerId: 'admin-tagger',
              config: { tag: 'ADMIN' },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      const userGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'user-s', providerId: 'user-tagger', config: { tag: 'USER' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const conditionalProcessors: StorageConditionalVariant<StoredProcessorGraph>[] = [
        {
          value: adminGraph,
          rules: {
            operator: 'AND',
            conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
          },
        },
        {
          value: userGraph,
          // No rules = fallback
        },
      ];

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-cond-proc', { inputProcessors: conditionalProcessors }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          'admin-tagger': makeTaggingInputProvider('admin-tagger', 'ADMIN'),
          'user-tagger': makeTaggingInputProvider('user-tagger', 'USER'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-cond-proc');

      // Admin context → admin-tagger processor
      const adminCtx = new RequestContext([['role', 'admin']]);
      const adminIds = await agent!.getConfiguredProcessorIds(adminCtx);
      expect(adminIds.inputProcessorIds).toEqual(['admin-tagger-instance']);

      // Regular user context → user-tagger processor
      const userCtx = new RequestContext([['role', 'user']]);
      const userIds = await agent!.getConfiguredProcessorIds(userCtx);
      expect(userIds.inputProcessorIds).toEqual(['user-tagger-instance']);
    });
  });

  describe('Complex graph — parallel branches', () => {
    it('should produce a ProcessorWorkflow for parallel processor branches', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'parallel',
            branches: [
              [
                {
                  type: 'step',
                  step: { id: 'ba', providerId: 'tagger-a', config: { tag: 'A' }, enabledPhases: ['processInput'] },
                },
              ],
              [
                {
                  type: 'step',
                  step: { id: 'bb', providerId: 'tagger-b', config: { tag: 'B' }, enabledPhases: ['processInput'] },
                },
              ],
            ],
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-parallel', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          'tagger-a': makeTaggingInputProvider('tagger-a', 'A'),
          'tagger-b': makeTaggingInputProvider('tagger-b', 'B'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-parallel');
      // Parallel graphs get combined into a single ProcessorWorkflow
      const processors = await agent!.listConfiguredInputProcessors();
      expect(processors.length).toBe(1);
      expect(isProcessorWorkflow(processors[0])).toBe(true);
    });
  });

  describe('Complex graph — conditional branches', () => {
    it('should produce a ProcessorWorkflow for conditional processor branches', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

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
                  {
                    type: 'step',
                    step: {
                      id: 'ca',
                      providerId: 'tagger-a',
                      config: { tag: 'COND-A' },
                      enabledPhases: ['processInput'],
                    },
                  },
                ],
              },
              {
                steps: [
                  {
                    type: 'step',
                    step: {
                      id: 'cb',
                      providerId: 'tagger-b',
                      config: { tag: 'COND-B' },
                      enabledPhases: ['processInput'],
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-cond-branch', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          'tagger-a': makeTaggingInputProvider('tagger-a', 'A'),
          'tagger-b': makeTaggingInputProvider('tagger-b', 'B'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-cond-branch');
      const processors = await agent!.listConfiguredInputProcessors();
      expect(processors.length).toBe(1);
      expect(isProcessorWorkflow(processors[0])).toBe(true);
    });
  });

  describe('Mixed sequential + parallel graph', () => {
    it('should produce a ProcessorWorkflow that wraps all steps', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'pre', providerId: 'tagger-pre', config: { tag: 'PRE' }, enabledPhases: ['processInput'] },
          },
          {
            type: 'parallel',
            branches: [
              [
                {
                  type: 'step',
                  step: { id: 'pa', providerId: 'tagger-a', config: { tag: 'A' }, enabledPhases: ['processInput'] },
                },
              ],
              [
                {
                  type: 'step',
                  step: { id: 'pb', providerId: 'tagger-b', config: { tag: 'B' }, enabledPhases: ['processInput'] },
                },
              ],
            ],
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-mixed', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: {
          'tagger-pre': makeTaggingInputProvider('tagger-pre', 'PRE'),
          'tagger-a': makeTaggingInputProvider('tagger-a', 'A'),
          'tagger-b': makeTaggingInputProvider('tagger-b', 'B'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      const agent = await editor.agent.getById('agent-mixed');
      const processors = await agent!.listConfiguredInputProcessors();

      // Complex graph → single ProcessorWorkflow
      expect(processors.length).toBe(1);
      expect(isProcessorWorkflow(processors[0])).toBe(true);
    });
  });

  describe('Config passthrough to provider', () => {
    it('should call createProcessor with the exact config from the stored graph', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      const createSpy = vi.fn().mockReturnValue({
        id: 'spy-instance',
        processInput: async ({ messages }: any) => messages,
      });

      const spyProvider: ProcessorProvider = {
        info: { id: 'spy', name: 'Spy Provider' },
        configSchema: z.object({ threshold: z.number(), mode: z.string() }),
        availablePhases: ['processInput'],
        createProcessor: createSpy,
      };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'spy-step',
              providerId: 'spy',
              config: { threshold: 0.85, mode: 'strict' },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-config-pass', { inputProcessors: graph }),
      });

      const editor = new MastraEditor({
        processorProviders: { spy: spyProvider },
      });
      const mastra = new Mastra({ storage, editor });

      await editor.agent.getById('agent-config-pass');

      expect(createSpy).toHaveBeenCalledWith({ threshold: 0.85, mode: 'strict' });
    });
  });

  describe('Versioning', () => {
    it('should hydrate different processor configs from different versions', async () => {
      const storage = new InMemoryStore();
      const agentsStore = await storage.getStore('agents');

      // Version 1: tagger with tag "V1"
      const graphV1: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'v1-step', providerId: 'tagger', config: { tag: 'V1' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      await agentsStore?.create({
        agent: makeStoredAgentConfig('agent-versioned', { inputProcessors: graphV1 }),
      });

      // Version 2: suffixer as output, no input processors
      const graphV2: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'v2-step',
              providerId: 'suffixer',
              config: { suffix: '-V2' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      await agentsStore?.createVersion({
        id: 'v2-id',
        agentId: 'agent-versioned',
        versionNumber: 2,
        name: 'Agent agent-versioned',
        instructions: 'You are a test assistant',
        model: { provider: 'openai', name: 'gpt-4' },
        outputProcessors: graphV2,
        changedFields: ['outputProcessors', 'inputProcessors'],
        changeMessage: 'V2: replaced input with output processors',
      });

      const editor = new MastraEditor({
        processorProviders: {
          tagger: makeTaggingInputProvider('tagger', 'DEFAULT'),
          suffixer: makeOutputSuffixProvider('suffixer', '!'),
        },
      });
      const mastra = new Mastra({ storage, editor });

      // Latest version (V2): no input procs, has output procs
      const latestAgent = await editor.agent.getById('agent-versioned');
      editor.agent.clearCache('agent-versioned');
      const latestIds = await latestAgent!.getConfiguredProcessorIds();
      expect(latestIds.inputProcessorIds).toEqual([]);
      expect(latestIds.outputProcessorIds).toEqual(['suffixer-instance']);

      // Version 1: has input procs, no output procs
      const v1Agent = await editor.agent.getById('agent-versioned', { versionNumber: 1 });
      const v1Ids = await v1Agent!.getConfiguredProcessorIds();
      expect(v1Ids.inputProcessorIds).toEqual(['tagger-instance']);
      expect(v1Ids.outputProcessorIds).toEqual([]);
    });
  });

  describe('ProcessorProvider registration on MastraEditor', () => {
    it('should list all registered processor providers including built-ins', () => {
      const tagger = makeTaggingInputProvider('tagger', 'X');
      const suffixer = makeOutputSuffixProvider('suffixer', '!');

      const editor = new MastraEditor({
        processorProviders: { tagger, suffixer },
      });

      const providers = editor.getProcessorProviders();
      // Custom providers are present
      expect(providers['tagger']).toBe(tagger);
      expect(providers['suffixer']).toBe(suffixer);
      // Built-in providers are also present
      expect(providers['unicode-normalizer']).toBeDefined();
      expect(providers['token-limiter']).toBeDefined();
      expect(providers['tool-call-filter']).toBeDefined();
      expect(providers['batch-parts']).toBeDefined();
      expect(providers['moderation']).toBeDefined();
      expect(providers['prompt-injection-detector']).toBeDefined();
      expect(providers['pii-detector']).toBeDefined();
      expect(providers['language-detector']).toBeDefined();
      expect(providers['system-prompt-scrubber']).toBeDefined();
    });

    it('should return individual provider by id', () => {
      const tagger = makeTaggingInputProvider('tagger', 'X');

      const editor = new MastraEditor({
        processorProviders: { tagger },
      });

      expect(editor.getProcessorProvider('tagger')).toBe(tagger);
      expect(editor.getProcessorProvider('nonexistent')).toBeUndefined();
    });

    it('should allow custom providers to override built-in ones', () => {
      const customUnicode = makeTaggingInputProvider('unicode-normalizer', 'CUSTOM');

      const editor = new MastraEditor({
        processorProviders: { 'unicode-normalizer': customUnicode },
      });

      const providers = editor.getProcessorProviders();
      // Custom provider overrides the built-in one
      expect(providers['unicode-normalizer']).toBe(customUnicode);
    });
  });

  describe('Processor execution through hydrated graph', () => {
    let mockModel: MockLanguageModelV2;

    beforeEach(() => {
      mockModel = new MockLanguageModelV2({
        doGenerate: async ({ prompt }) => {
          const messages = Array.isArray(prompt) ? prompt : [];
          const textContent = messages
            .map(msg => {
              if (typeof msg.content === 'string') return msg.content;
              if (Array.isArray(msg.content)) {
                return msg.content
                  .filter(part => part.type === 'text')
                  .map(part => (part as any).text)
                  .join(' ');
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');

          return {
            content: [{ type: 'text', text: `echo: ${textContent}` }],
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            rawCall: { rawPrompt: prompt, rawSettings: {} },
            warnings: [],
          };
        },
        doStream: async ({ prompt }) => {
          const messages = Array.isArray(prompt) ? prompt : [];
          const textContent = messages
            .map(msg => {
              if (typeof msg.content === 'string') return msg.content;
              if (Array.isArray(msg.content)) {
                return msg.content
                  .filter(part => part.type === 'text')
                  .map(part => (part as any).text)
                  .join(' ');
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');

          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: `echo: ${textContent}` },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
            ]),
            rawCall: { rawPrompt: prompt, rawSettings: {} },
            warnings: [],
          };
        },
      });
    });

    it('should execute a hydrated input processor that modifies the user message', async () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'tagger-step',
              providerId: 'tagger',
              config: { tag: 'PROCESSED' },
              enabledPhases: ['processInput'],
            },
          },
        ],
      };

      const providers = { tagger: makeTaggingInputProvider('tagger', 'DEFAULT') };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-input-test',
        name: 'Exec Input Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // The mock model echoes back what it receives. The tagger prepends [PROCESSED]
      // to text parts, so the model should see "[PROCESSED] Hello" in its prompt.
      expect(result.text).toContain('[PROCESSED] Hello');
    }, 10000);

    it('should execute chained input processors in sequence', async () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'first', config: { tag: 'FIRST' }, enabledPhases: ['processInput'] },
          },
          {
            type: 'step',
            step: { id: 's2', providerId: 'second', config: { tag: 'SECOND' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const providers = {
        first: makeTaggingInputProvider('first', 'FIRST'),
        second: makeTaggingInputProvider('second', 'SECOND'),
      };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-chained-test',
        name: 'Exec Chained Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // Second processor wraps the output of the first: [SECOND] [FIRST] Hello
      expect(result.text).toContain('[SECOND] [FIRST] Hello');
    }, 10000);

    it('should execute a hydrated output processor that transforms the response', async () => {
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'suffix-step',
              providerId: 'suffixer',
              config: { suffix: ' [DONE]' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      const providers = { suffixer: makeOutputSuffixProvider('suffixer', '!') };
      const outputProcessors = hydrateProcessorGraph(graph, 'output', { providers });

      const agent = new Agent({
        id: 'exec-output-test',
        name: 'Exec Output Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        outputProcessors: outputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // The suffixer appends " [DONE]" to the model's output text
      expect(result.text).toContain('[DONE]');
      expect(result.text).toMatch(/echo:.*Hello.*\[DONE\]/);
    }, 10000);

    it('should execute both input and output processors on the same agent', async () => {
      const inputGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'in', providerId: 'tagger', config: { tag: 'IN' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const outputGraph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: {
              id: 'out',
              providerId: 'suffixer',
              config: { suffix: ' [OUT]' },
              enabledPhases: ['processOutputResult'],
            },
          },
        ],
      };

      const providers = {
        tagger: makeTaggingInputProvider('tagger', 'DEFAULT'),
        suffixer: makeOutputSuffixProvider('suffixer', '!'),
      };

      const inputProcessors = hydrateProcessorGraph(inputGraph, 'input', { providers });
      const outputProcessors = hydrateProcessorGraph(outputGraph, 'output', { providers });

      const agent = new Agent({
        id: 'exec-both-test',
        name: 'Exec Both Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
        outputProcessors: outputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // Input processor prepends [IN] → model sees "[IN] Hello" → echoes it back
      // Output processor appends " [OUT]" to the response text
      expect(result.text).toContain('[IN] Hello');
      expect(result.text).toContain('[OUT]');
    }, 10000);

    it('should respect phase filtering during execution — disabled phase is not called', async () => {
      const processInputSpy = vi.fn(async ({ messages }: any) =>
        messages.map((m: any) => ({
          ...m,
          content: {
            ...m.content,
            parts: (m.content?.parts ?? []).map((p: any) =>
              p.type === 'text' ? { ...p, text: `[DUAL-IN] ${p.text}` } : p,
            ),
          },
        })),
      );

      const processOutputResultSpy = vi.fn(async ({ messages }: any) =>
        messages.map((m: any) => ({
          ...m,
          content: {
            ...m.content,
            parts: (m.content?.parts ?? []).map((p: any) =>
              p.type === 'text' ? { ...p, text: `${p.text}[DUAL-OUT]` } : p,
            ),
          },
        })),
      );

      const dualProvider: ProcessorProvider = {
        info: { id: 'dual', name: 'Dual Provider' },
        configSchema: z.object({}),
        availablePhases: ['processInput', 'processOutputResult'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'dual-instance' as any,
            name: 'Dual Instance',
            processInput: processInputSpy,
            processOutputResult: processOutputResultSpy,
          };
        },
      };

      // Only enable processInput — processOutputResult should be stripped
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'd', providerId: 'dual', config: {}, enabledPhases: ['processInput'] },
          },
        ],
      };

      const providers = { dual: dualProvider };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-phase-filter-test',
        name: 'Exec Phase Filter Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      await agent.generate('Hello');

      // processInput was called (phase enabled)
      expect(processInputSpy).toHaveBeenCalled();
      // processOutputResult was NOT called (phase disabled by PhaseFilteredProcessor)
      expect(processOutputResultSpy).not.toHaveBeenCalled();
    }, 10000);

    it('should pass provider config to the processor and use it during execution', async () => {
      // Use different tags via config to prove config passthrough affects execution
      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 's1', providerId: 'tagger', config: { tag: 'CUSTOM-TAG-42' }, enabledPhases: ['processInput'] },
          },
        ],
      };

      const providers = { tagger: makeTaggingInputProvider('tagger', 'SHOULD-NOT-SEE-THIS') };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-config-test',
        name: 'Exec Config Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // The config { tag: 'CUSTOM-TAG-42' } should be used, not the default 'SHOULD-NOT-SEE-THIS'
      expect(result.text).toContain('[CUSTOM-TAG-42] Hello');
      expect(result.text).not.toContain('SHOULD-NOT-SEE-THIS');
    }, 10000);

    it('should execute a parallel processor graph — both branches run', async () => {
      // Track which processors actually ran
      const branchACalled = vi.fn();
      const branchBCalled = vi.fn();

      const branchAProvider: ProcessorProvider = {
        info: { id: 'branch-a', name: 'Branch A' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'branch-a-instance' as any,
            name: 'Branch A Instance',
            processInput: async ({ messages }: any) => {
              branchACalled();
              return messages.map((m: any) => ({
                ...m,
                content: {
                  ...m.content,
                  parts: (m.content?.parts ?? []).map((p: any) =>
                    p.type === 'text' ? { ...p, text: `[A] ${p.text}` } : p,
                  ),
                },
              }));
            },
          };
        },
      };

      const branchBProvider: ProcessorProvider = {
        info: { id: 'branch-b', name: 'Branch B' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'branch-b-instance' as any,
            name: 'Branch B Instance',
            processInput: async ({ messages }: any) => {
              branchBCalled();
              return messages.map((m: any) => ({
                ...m,
                content: {
                  ...m.content,
                  parts: (m.content?.parts ?? []).map((p: any) =>
                    p.type === 'text' ? { ...p, text: `[B] ${p.text}` } : p,
                  ),
                },
              }));
            },
          };
        },
      };

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'parallel',
            branches: [
              [
                {
                  type: 'step',
                  step: { id: 'pa', providerId: 'branch-a', config: {}, enabledPhases: ['processInput'] },
                },
              ],
              [
                {
                  type: 'step',
                  step: { id: 'pb', providerId: 'branch-b', config: {}, enabledPhases: ['processInput'] },
                },
              ],
            ],
          },
        ],
      };

      const providers = { 'branch-a': branchAProvider, 'branch-b': branchBProvider };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-parallel-test',
        name: 'Exec Parallel Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      await agent.generate('Hello');

      // Both branches should have been called (parallel execution)
      expect(branchACalled).toHaveBeenCalled();
      expect(branchBCalled).toHaveBeenCalled();
    }, 10000);

    it('should execute a conditional processor graph — only matching branches run', async () => {
      // workflow.branch() runs ALL branches whose condition returns true.
      // Use mutually exclusive conditions so exactly one branch runs.
      const inputBranchCalled = vi.fn();
      const outputBranchCalled = vi.fn();

      const inputBranchProvider: ProcessorProvider = {
        info: { id: 'input-branch', name: 'Input Branch' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'input-branch-instance' as any,
            name: 'Input Branch Instance',
            processInput: async ({ messages }: any) => {
              inputBranchCalled();
              return messages.map((m: any) => ({
                ...m,
                content: {
                  ...m.content,
                  parts: (m.content?.parts ?? []).map((p: any) =>
                    p.type === 'text' ? { ...p, text: `[INPUT-BRANCH] ${p.text}` } : p,
                  ),
                },
              }));
            },
          };
        },
      };

      const outputBranchProvider: ProcessorProvider = {
        info: { id: 'output-branch', name: 'Output Branch' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'output-branch-instance' as any,
            name: 'Output Branch Instance',
            processInput: async ({ messages }: any) => {
              outputBranchCalled();
              return messages.map((m: any) => ({
                ...m,
                content: {
                  ...m.content,
                  parts: (m.content?.parts ?? []).map((p: any) =>
                    p.type === 'text' ? { ...p, text: `[OUTPUT-BRANCH] ${p.text}` } : p,
                  ),
                },
              }));
            },
          };
        },
      };

      // Two mutually exclusive conditions: phase=input vs phase=outputResult
      // Since this is an input processor, phase will be 'input', so only first branch runs
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
                    step: { id: 'ci', providerId: 'input-branch', config: {}, enabledPhases: ['processInput'] },
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
                    step: { id: 'co', providerId: 'output-branch', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
            ],
          },
        ],
      };

      const providers = { 'input-branch': inputBranchProvider, 'output-branch': outputBranchProvider };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-cond-test',
        name: 'Exec Conditional Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // The input branch should run (phase === 'input' matches)
      expect(inputBranchCalled).toHaveBeenCalled();
      // The output branch should NOT run (phase !== 'outputResult' during input processing)
      expect(outputBranchCalled).not.toHaveBeenCalled();
      // Verify the output reflects only the input branch's transformation
      expect(result.text).toContain('[INPUT-BRANCH]');
      expect(result.text).not.toContain('[OUTPUT-BRANCH]');
    }, 10000);

    it('should execute the default branch when no condition matches', async () => {
      const unmatchedBranchCalled = vi.fn();
      const defaultBranchCalled = vi.fn();

      const unmatchedProvider: ProcessorProvider = {
        info: { id: 'unmatched', name: 'Unmatched' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'unmatched-instance' as any,
            name: 'Unmatched Instance',
            processInput: async ({ messages }: any) => {
              unmatchedBranchCalled();
              return messages;
            },
          };
        },
      };

      const defaultProvider: ProcessorProvider = {
        info: { id: 'fallback', name: 'Fallback' },
        configSchema: z.object({}),
        availablePhases: ['processInput'] as ProcessorPhase[],
        createProcessor(): Processor {
          return {
            id: 'fallback-instance' as any,
            name: 'Fallback Instance',
            processInput: async ({ messages }: any) => {
              defaultBranchCalled();
              return messages.map((m: any) => ({
                ...m,
                content: {
                  ...m.content,
                  parts: (m.content?.parts ?? []).map((p: any) =>
                    p.type === 'text' ? { ...p, text: `[FALLBACK] ${p.text}` } : p,
                  ),
                },
              }));
            },
          };
        },
      };

      // Condition: phase equals 'nonexistent' → never matches
      // Default branch: no rules → always matches as fallback
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
                    step: { id: 'cu', providerId: 'unmatched', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
              {
                // Default fallback (no rules)
                steps: [
                  {
                    type: 'step',
                    step: { id: 'cf', providerId: 'fallback', config: {}, enabledPhases: ['processInput'] },
                  },
                ],
              },
            ],
          },
        ],
      };

      const providers = { unmatched: unmatchedProvider, fallback: defaultProvider };
      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-cond-default-test',
        name: 'Exec Conditional Default Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      const result = await agent.generate('Hello');

      // The unmatched branch should NOT run
      expect(unmatchedBranchCalled).not.toHaveBeenCalled();
      // The default branch SHOULD run (fallback)
      expect(defaultBranchCalled).toHaveBeenCalled();
      // Verify the output has the fallback tag
      expect(result.text).toContain('[FALLBACK]');
    }, 10000);

    it('should execute a sequential step followed by parallel branches', async () => {
      const preSpy = vi.fn();
      const branchASpy = vi.fn();
      const branchBSpy = vi.fn();

      function makeSpyProvider(id: string, tag: string, spy: ReturnType<typeof vi.fn>): ProcessorProvider {
        return {
          info: { id, name: id },
          configSchema: z.object({}),
          availablePhases: ['processInput'] as ProcessorPhase[],
          createProcessor(): Processor {
            return {
              id: `${id}-instance` as any,
              name: `${id} Instance`,
              processInput: async ({ messages }: any) => {
                spy();
                return messages.map((m: any) => ({
                  ...m,
                  content: {
                    ...m.content,
                    parts: (m.content?.parts ?? []).map((p: any) =>
                      p.type === 'text' ? { ...p, text: `[${tag}] ${p.text}` } : p,
                    ),
                  },
                }));
              },
            };
          },
        };
      }

      const graph: StoredProcessorGraph = {
        steps: [
          {
            type: 'step',
            step: { id: 'pre', providerId: 'pre-proc', config: {}, enabledPhases: ['processInput'] },
          },
          {
            type: 'parallel',
            branches: [
              [
                {
                  type: 'step',
                  step: { id: 'pa', providerId: 'branch-a', config: {}, enabledPhases: ['processInput'] },
                },
              ],
              [
                {
                  type: 'step',
                  step: { id: 'pb', providerId: 'branch-b', config: {}, enabledPhases: ['processInput'] },
                },
              ],
            ],
          },
        ],
      };

      const providers = {
        'pre-proc': makeSpyProvider('pre-proc', 'PRE', preSpy),
        'branch-a': makeSpyProvider('branch-a', 'A', branchASpy),
        'branch-b': makeSpyProvider('branch-b', 'B', branchBSpy),
      };

      const inputProcessors = hydrateProcessorGraph(graph, 'input', { providers });

      const agent = new Agent({
        id: 'exec-mixed-test',
        name: 'Exec Mixed Test',
        instructions: 'You are a test assistant',
        model: mockModel,
        inputProcessors: inputProcessors as any,
      });

      await agent.generate('Hello');

      // All three processors should have executed:
      // pre-step runs first, then both parallel branches
      expect(preSpy).toHaveBeenCalled();
      expect(branchASpy).toHaveBeenCalled();
      expect(branchBSpy).toHaveBeenCalled();
    }, 10000);
  });
});
