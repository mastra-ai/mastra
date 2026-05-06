import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import type { MastraDBMessage } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/evals';
import { MastraEditor } from './index';
import { randomUUID } from 'crypto';
import { LibSQLStore } from '@mastra/libsql';
import { convertArrayToReadableStream, LanguageModelV2, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraModelGateway, ProviderConfig } from '@mastra/core/llm';

// =============================================================================
// Test Helpers
// =============================================================================

const createTestStorage = () => {
  return new LibSQLStore({
    id: `test-${randomUUID()}`,
    url: ':memory:',
  });
};

/**
 * Create a MockLanguageModelV2 that returns specific responses in sequence.
 * For scorer execution, the pipeline calls doGenerate twice:
 *   1. generateScore → expects JSON text like '{"score": 0.85}'
 *   2. generateReason → expects plain text like 'Good response.'
 *
 * Returns { modelId, mockLLM } — each call gets a unique modelId to avoid
 * ModelRouterLanguageModel's static instance cache causing cross-test pollution.
 */
const createScorerMockLLM = (score: number, reason: string) => {
  let callIndex = 0;
  const modelId = `scorer-model-${randomUUID()}`;

  const mockLLM = new MockLanguageModelV2({
    doGenerate: async () => {
      const text = callIndex === 0 ? JSON.stringify({ score }) : reason;
      callIndex++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content: [{ type: 'text' as const, text }],
        warnings: [],
      };
    },
    doStream: async () => {
      const text = callIndex === 0 ? JSON.stringify({ score }) : reason;
      callIndex++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: text },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });

  return { modelId, mockLLM };
};

/**
 * A MockGateway that resolves mock model IDs to MockLanguageModelV2 instances.
 * Each test should use a unique modelId (via createScorerMockLLM) to avoid
 * ModelRouterLanguageModel's static instance cache causing cross-test pollution.
 */
class ScorerMockGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Scorer Mock Gateway';
  private models: Map<string, LanguageModelV2> = new Map();

  constructor() {
    super();
  }

  registerModel(modelId: string, model: LanguageModelV2) {
    this.models.set(modelId, model);
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: {
        name: 'Mock Provider',
        models: Array.from(this.models.keys()),
        apiKeyEnvVar: 'MOCK_API_KEY',
        gateway: 'models.dev',
      },
    };
  }
  buildUrl(_modelId: string): string {
    return 'https://api.mock-gateway.com/v1';
  }
  getApiKey(_modelId: string): Promise<string> {
    return Promise.resolve('MOCK_API_KEY');
  }

  async resolveEmbeddingModel(_args: { modelId: string; providerId: string; apiKey: string }): Promise<any> {
    throw new Error('Not implemented');
  }

  async resolveLanguageModel(args: {
    modelId: string;
    providerId: string;
    apiKey: string;
    headers?: Record<string, string>;
  }): Promise<LanguageModelV2> {
    const model = this.models.get(args.modelId);
    if (!model) throw new Error(`Unknown mock model: ${args.modelId}`);
    return model;
  }
}

/**
 * Create a MastraDBMessage for testing.
 */
function createTestMessage({
  content,
  role,
  id = 'test-message',
}: {
  content: string;
  role: 'user' | 'assistant' | 'system';
  id?: string;
}): MastraDBMessage {
  return {
    id,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text: content }],
      content,
    },
    createdAt: new Date(),
  };
}

/**
 * Create a test run object for agent-type scorers.
 */
function createAgentTestRun({
  inputMessages = [],
  output,
}: {
  inputMessages?: MastraDBMessage[];
  output: MastraDBMessage[];
}): {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
  runId: string;
} {
  return {
    input: {
      inputMessages,
      rememberedMessages: [],
      systemMessages: [],
      taggedSystemMessages: {},
    },
    output,
    runId: randomUUID(),
  };
}

// =============================================================================
// Scorer Definition CRUD Tests (LibSQL)
// =============================================================================

describe('Scorer Definition CRUD (LibSQL)', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    storage = createTestStorage();
    editor = new MastraEditor();
    mastra = new Mastra({ storage, editor });
    await storage.init();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should create a custom-llm-judge scorer definition and retrieve it', async () => {
    const created = await editor.scorer.create({
      id: 'my-judge',
      name: 'My Custom Judge',
      description: 'Evaluates helpfulness',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Rate how helpful the response is.',
      scoreRange: { min: 0, max: 10 },
    });

    expect(created.id).toBe('my-judge');
    expect(created.name).toBe('My Custom Judge');
    expect(created.type).toBe('llm-judge');
    expect(created.model?.provider).toBe('openai');
    expect(created.instructions).toBe('Rate how helpful the response is.');
    expect(created.scoreRange?.max).toBe(10);

    const fetched = await editor.scorer.getById('my-judge');
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe('my-judge');
    expect(fetched?.name).toBe('My Custom Judge');
    expect(fetched?.type).toBe('llm-judge');
    expect(fetched?.instructions).toBe('Rate how helpful the response is.');
  });

  it('should create a preset scorer definition and retrieve it', async () => {
    const created = await editor.scorer.create({
      id: 'my-bias-checker',
      name: 'Bias Checker',
      description: 'Checks for bias in responses',
      type: 'bias',
      model: { provider: 'openai', name: 'gpt-4o' },
      presetConfig: { scale: 10 },
    });

    expect(created.id).toBe('my-bias-checker');
    expect(created.type).toBe('bias');
    expect(created.presetConfig?.scale).toBe(10);
  });

  it('should update a scorer definition and get updated values', async () => {
    await editor.scorer.create({
      id: 'updatable',
      name: 'Original Name',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Original instructions',
    });

    // Config changes require createVersion + update(activeVersionId)
    const scorerStore = await storage.getStore('scorerDefinitions');
    await scorerStore!.createVersion({
      id: crypto.randomUUID(),
      scorerDefinitionId: 'updatable',
      versionNumber: 2,
      name: 'Updated Name',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Updated instructions',
      scoreRange: { min: 1, max: 5 },
      changedFields: ['name', 'instructions', 'scoreRange'],
    });
    const latestVersion = await scorerStore!.getLatestVersion('updatable');
    await scorerStore!.update({ id: 'updatable', activeVersionId: latestVersion!.id, status: 'published' });
    editor.scorer.clearCache('updatable');

    const updated = await editor.scorer.getById('updatable');

    expect(updated!.name).toBe('Updated Name');
    expect(updated!.instructions).toBe('Updated instructions');
    expect(updated!.scoreRange?.min).toBe(1);
    expect(updated!.scoreRange?.max).toBe(5);
  });

  it('should delete a scorer definition', async () => {
    await editor.scorer.create({
      id: 'to-delete',
      name: 'Delete Me',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Some instructions',
    });

    const fetched = await editor.scorer.getById('to-delete');
    expect(fetched).not.toBeNull();

    await editor.scorer.delete('to-delete');

    const deleted = await editor.scorer.getById('to-delete');
    expect(deleted).toBeNull();
  });

  it('should list scorer definitions with pagination', async () => {
    for (let i = 0; i < 5; i++) {
      await editor.scorer.create({
        id: `scorer-${i}`,
        name: `Scorer ${i}`,
        type: 'llm-judge',
        model: { provider: 'openai', name: 'gpt-4' },
        instructions: `Instructions ${i}`,
      });
    }

    const allResult = await editor.scorer.list();
    expect(allResult.total).toBe(5);
    expect(allResult.scorerDefinitions.length).toBe(5);

    const page1 = await editor.scorer.list({ page: 0, perPage: 2 });
    expect(page1.scorerDefinitions.length).toBe(2);
    expect(page1.total).toBe(5);
    expect(page1.hasMore).toBe(true);

    const page2 = await editor.scorer.list({ page: 1, perPage: 2 });
    expect(page2.scorerDefinitions.length).toBe(2);
    expect(page2.hasMore).toBe(true);
  });

  it('should list resolved scorer definitions with version config', async () => {
    await editor.scorer.create({
      id: 'resolved-scorer',
      name: 'Resolved Scorer',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Evaluate accuracy',
    });

    const result = await editor.scorer.listResolved();
    expect(result.total).toBe(1);
    expect(result.scorerDefinitions.length).toBe(1);
    expect(result.scorerDefinitions[0]!.name).toBe('Resolved Scorer');
    expect(result.scorerDefinitions[0]!.type).toBe('llm-judge');
    expect(result.scorerDefinitions[0]!.instructions).toBe('Evaluate accuracy');
  });

  it('should return null for non-existent scorer definition', async () => {
    const result = await editor.scorer.getById('does-not-exist');
    expect(result).toBeNull();
  });

  it('should throw if editor is not registered with Mastra', async () => {
    const unregistered = new MastraEditor();
    await expect(
      unregistered.scorer.create({
        id: 'test',
        name: 'Test',
        type: 'llm-judge',
        model: { provider: 'openai', name: 'gpt-4' },
        instructions: 'test',
      }),
    ).rejects.toThrow('MastraEditor is not registered with a Mastra instance');
  });
});

// =============================================================================
// scorer.resolve Tests
// =============================================================================

describe('scorer.resolve', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    storage = createTestStorage();
    editor = new MastraEditor();
    mastra = new Mastra({ storage, editor });
    await storage.init();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should create a MastraScorer from a custom-llm-judge stored config', () => {
    const scorer = editor.scorer.resolve({
      id: 'judge-scorer',
      name: 'Judge Scorer',
      description: 'A test judge',
      type: 'llm-judge',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Rate the helpfulness on a scale of 0 to 1.',
      scoreRange: { min: 0, max: 1 },
    });

    expect(scorer).not.toBeNull();
    expect(scorer!.id).toBe('judge-scorer');
    expect(scorer!.name).toBe('Judge Scorer');
  });

  it('should return null for custom-llm-judge without instructions', () => {
    const warnSpy = vi.fn();
    const warnEditor = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    new Mastra({ storage, editor: warnEditor });

    const scorer = warnEditor.scorer.resolve({
      id: 'no-instructions',
      name: 'No Instructions',
      type: 'llm-judge',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      model: { provider: 'openai', name: 'gpt-4' },
    });

    expect(scorer).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no instructions'));
  });

  it('should return null for custom-llm-judge without model config', () => {
    const warnSpy = vi.fn();
    const warnEditor = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    new Mastra({ storage, editor: warnEditor });

    const scorer = warnEditor.scorer.resolve({
      id: 'no-model',
      name: 'No Model',
      type: 'llm-judge',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      instructions: 'Evaluate the output.',
    });

    expect(scorer).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no valid model configuration'));
  });

  it('should return null for preset type with a warning', () => {
    const warnSpy = vi.fn();
    const warnEditor = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    new Mastra({ storage, editor: warnEditor });

    const scorer = warnEditor.scorer.resolve({
      id: 'preset-scorer',
      name: 'Preset Scorer',
      type: 'bias',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      presetConfig: { scale: 10 },
    });

    expect(scorer).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('preset type'));
  });

  it('should return null for unknown type with a warning', () => {
    const warnSpy = vi.fn();
    const warnEditor = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    new Mastra({ storage, editor: warnEditor });

    const scorer = warnEditor.scorer.resolve({
      id: 'unknown-type',
      name: 'Unknown Type',
      type: 'something-else' as any,
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(scorer).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('preset type'));
  });
});

// =============================================================================
// Stored Agent Scorer Resolution with DB Fallback
// =============================================================================

describe('resolveStoredScorers with DB fallback', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    storage = createTestStorage();
    editor = new MastraEditor();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should resolve a scorer from the DB when not found in the registry', async () => {
    mastra = new Mastra({ storage, editor });
    await storage.init();

    await editor.scorer.create({
      id: 'db-scorer',
      name: 'DB Scorer',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Rate the quality of the response.',
      scoreRange: { min: 0, max: 1 },
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-with-db-scorer',
        name: 'Agent With DB Scorer',
        instructions: 'You are a helpful assistant.',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'db-scorer': {},
        },
      },
    });

    const agent = await editor.agent.getById('agent-with-db-scorer');
    expect(agent).toBeInstanceOf(Agent);
    expect(agent?.id).toBe('agent-with-db-scorer');
    const scorers = await agent?.listScorers();
    expect(Object.keys(scorers!)).toContain('db-scorer');
    expect(scorers!['db-scorer']?.scorer.id).toBe('db-scorer');
  });

  it('should prefer DB scorer over registry scorer', async () => {
    const registeredScorer = createScorer({
      id: 'registry-scorer',
      description: 'From registry',
    }).generateScore(() => 0.9);

    mastra = new Mastra({
      storage,
      editor,
      scorers: { 'registry-scorer': registeredScorer },
    });
    await storage.init();

    await editor.scorer.create({
      id: 'registry-scorer',
      name: 'DB version of registry scorer',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'DB scorer should take priority over registry.',
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-prefers-db',
        name: 'Agent Prefers DB',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'registry-scorer': { sampling: { type: 'ratio' as const, rate: 0.5 } },
        },
      },
    });

    const agent = await editor.agent.getById('agent-prefers-db');
    expect(agent).toBeInstanceOf(Agent);

    // The resolved scorer should be from DB (custom-llm-judge), not the registry (code-based)
    const scorers = await agent?.listScorers();
    expect(Object.keys(scorers!)).toHaveLength(1);
    expect(Object.keys(scorers!)).toContain('registry-scorer');
    // DB scorer is an LLM judge, so it should have generateScore and generateReason steps.
    // The registry scorer is a simple code-based scorer. We can distinguish them by
    // checking that the resolved scorer's name matches the DB version.
    expect(scorers!['registry-scorer']?.scorer.name).toBe('DB version of registry scorer');
  });

  it('should warn when scorer is not found in registry or DB', async () => {
    const warnSpy = vi.fn();
    const warnEditor = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    mastra = new Mastra({ storage, editor: warnEditor });
    await storage.init();

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-with-ghost-scorer',
        name: 'Agent With Ghost Scorer',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'non-existent-scorer': {},
        },
      },
    });

    const agent = await warnEditor.agent.getById('agent-with-ghost-scorer');
    expect(agent).toBeInstanceOf(Agent);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found in registry or storage'));
  });

  it('should resolve multiple scorers mixing registry and DB', async () => {
    const registeredScorer = createScorer({
      id: 'code-scorer',
      description: 'Simple code scorer',
    }).generateScore(() => 0.7);

    mastra = new Mastra({
      storage,
      editor,
      scorers: { 'code-scorer': registeredScorer },
    });
    await storage.init();

    await editor.scorer.create({
      id: 'db-judge',
      name: 'DB Judge',
      type: 'llm-judge',
      model: { provider: 'openai', name: 'gpt-4' },
      instructions: 'Evaluate the response.',
    });

    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-mixed-scorers',
        name: 'Agent Mixed Scorers',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'code-scorer': { sampling: { type: 'ratio' as const, rate: 1 } },
          'db-judge': { sampling: { type: 'ratio' as const, rate: 0.5 } },
        },
      },
    });

    const agent = await editor.agent.getById('agent-mixed-scorers');
    expect(agent).toBeInstanceOf(Agent);
    expect(agent?.id).toBe('agent-mixed-scorers');

    const scorers = await agent?.listScorers();
    expect(Object.keys(scorers!)).toContain('code-scorer');
    expect(Object.keys(scorers!)).toContain('db-judge');
  });
});

// =============================================================================
// Scorer Execution Tests — store in DB, retrieve, create via scorer.resolve, execute
// =============================================================================

describe('Stored scorer execution', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    storage = createTestStorage();
    editor = new MastraEditor();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should store a scorer in DB, retrieve it, create via scorer.resolve, and execute', async () => {
    const { modelId, mockLLM } = createScorerMockLLM(0.85, 'The response was highly relevant and accurate.');
    const gateway = new ScorerMockGateway();
    gateway.registerModel(modelId, mockLLM);
    mastra = new Mastra({ storage, editor, gateways: { 'models.dev': gateway } });
    await storage.init();

    // Store scorer definition in DB
    await editor.scorer.create({
      id: 'db-exec-scorer',
      name: 'DB Execution Scorer',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelId },
      instructions: 'You are an expert evaluator. Rate quality on a scale of 0 to 1.',
      scoreRange: { min: 0, max: 1 },
    });

    // Retrieve from DB
    const storedDef = await editor.scorer.getById('db-exec-scorer');
    expect(storedDef).not.toBeNull();
    expect(storedDef!.instructions).toContain('expert evaluator');

    // Create scorer via scorer.resolve (resolves model through gateway)
    const scorer = editor.scorer.resolve(storedDef!);
    expect(scorer).not.toBeNull();
    expect(scorer!.id).toBe('db-exec-scorer');

    // Execute the scorer
    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'What is the capital of France?', role: 'user', id: 'input-1' })],
      output: [createTestMessage({ content: 'The capital of France is Paris.', role: 'assistant', id: 'output-1' })],
    });

    const result = await scorer!.run(testRun);
    expect(result.score).toBe(0.85);
    expect(result.reason).toBe('The response was highly relevant and accurate.');
    expect(result.runId).toBeDefined();
  });

  it('should execute a stored scorer with a custom score range', async () => {
    const { modelId, mockLLM } = createScorerMockLLM(7.5, 'Good response with some room for improvement.');
    const gateway = new ScorerMockGateway();
    gateway.registerModel(modelId, mockLLM);
    mastra = new Mastra({ storage, editor, gateways: { 'models.dev': gateway } });
    await storage.init();

    // Store scorer in DB with custom score range
    await editor.scorer.create({
      id: 'range-scorer',
      name: 'Range Scorer',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelId },
      instructions: 'Score the response on a scale of 1 to 10.',
      scoreRange: { min: 1, max: 10 },
    });

    // Retrieve and create scorer from stored config
    const storedDef = await editor.scorer.getById('range-scorer');
    const scorer = editor.scorer.resolve(storedDef!);
    expect(scorer).not.toBeNull();

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Summarize quantum computing', role: 'user', id: 'input-1' })],
      output: [
        createTestMessage({
          content: 'Quantum computing uses quantum bits to perform calculations.',
          role: 'assistant',
          id: 'output-1',
        }),
      ],
    });

    const result = await scorer!.run(testRun);
    expect(result.score).toBe(7.5);
    expect(result.reason).toBe('Good response with some room for improvement.');
  });
});

// =============================================================================
// End-to-end: Store → Retrieve → scorer.resolve → Execute
// =============================================================================

describe('End-to-end scorer storage and execution flow', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    storage = createTestStorage();
    editor = new MastraEditor();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('should store a scorer definition, retrieve it, and create a working scorer via scorer.resolve', async () => {
    const { modelId, mockLLM } = createScorerMockLLM(0.75, 'Decent response.');
    const gateway = new ScorerMockGateway();
    gateway.registerModel(modelId, mockLLM);
    const mastra = new Mastra({ storage, editor, gateways: { 'models.dev': gateway } });
    await storage.init();

    // Store the scorer definition in DB
    await editor.scorer.create({
      id: 'e2e-scorer',
      name: 'E2E Scorer',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelId },
      instructions: 'Evaluate response quality.',
      scoreRange: { min: 0, max: 1 },
    });

    // Retrieve the stored definition from DB
    const storedDef = await editor.scorer.getById('e2e-scorer');
    expect(storedDef).not.toBeNull();
    expect(storedDef!.type).toBe('llm-judge');
    expect(storedDef!.instructions).toBe('Evaluate response quality.');

    // Create scorer from stored config (resolves model through gateway)
    const scorer = editor.scorer.resolve(storedDef!);
    expect(scorer).not.toBeNull();

    // Execute the scorer
    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'input-1' })],
      output: [createTestMessage({ content: 'Hi there!', role: 'assistant', id: 'output-1' })],
    });

    const result = await scorer!.run(testRun);
    expect(result.score).toBe(0.75);
    expect(result.reason).toBe('Decent response.');
  });

  it('should update a stored scorer, retrieve it, and execute with the updated config', async () => {
    const { modelId, mockLLM } = createScorerMockLLM(8.0, 'Very thorough and detailed.');
    const gateway = new ScorerMockGateway();
    gateway.registerModel(modelId, mockLLM);
    const mastra = new Mastra({ storage, editor, gateways: { 'models.dev': gateway } });
    await storage.init();

    // Create
    await editor.scorer.create({
      id: 'lifecycle-scorer',
      name: 'Lifecycle Scorer v1',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelId },
      instructions: 'Version 1 instructions',
      scoreRange: { min: 0, max: 5 },
    });

    // Update — config changes require createVersion + update(activeVersionId)
    const scorerStore = await storage.getStore('scorerDefinitions');
    await scorerStore!.createVersion({
      id: crypto.randomUUID(),
      scorerDefinitionId: 'lifecycle-scorer',
      versionNumber: 2,
      name: 'Lifecycle Scorer v2',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelId },
      instructions: 'Version 2: evaluate response quality more carefully.',
      scoreRange: { min: 0, max: 10 },
      changedFields: ['name', 'instructions', 'scoreRange'],
    });
    const latestVersion = await scorerStore!.getLatestVersion('lifecycle-scorer');
    await scorerStore!.update({ id: 'lifecycle-scorer', activeVersionId: latestVersion!.id, status: 'published' });
    editor.scorer.clearCache('lifecycle-scorer');

    const updated = await editor.scorer.getById('lifecycle-scorer');
    expect(updated!.name).toBe('Lifecycle Scorer v2');
    expect(updated!.scoreRange?.max).toBe(10);

    // Retrieve latest version from DB
    const fetched = await editor.scorer.getById('lifecycle-scorer');
    expect(fetched!.scoreRange?.max).toBe(10);

    // Create scorer from stored config (resolves model through gateway)
    const scorer = editor.scorer.resolve(fetched!);
    expect(scorer).not.toBeNull();

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'input-1' })],
      output: [createTestMessage({ content: 'Hi there!', role: 'assistant', id: 'output-1' })],
    });

    const result = await scorer!.run(testRun);
    expect(result.score).toBe(8.0);
    expect(result.reason).toBe('Very thorough and detailed.');
  });

  it('should handle the full CRUD lifecycle: create, list, update, delete', async () => {
    const mastra = new Mastra({ storage, editor });
    await storage.init();

    await editor.scorer.create({
      id: 'lifecycle-1',
      name: 'Lifecycle 1',
      type: 'llm-judge',
      model: { provider: 'mock', name: 'scorer-model' },
      instructions: 'Test 1',
    });
    await editor.scorer.create({
      id: 'lifecycle-2',
      name: 'Lifecycle 2',
      type: 'llm-judge',
      model: { provider: 'mock', name: 'scorer-model' },
      instructions: 'Test 2',
    });

    let list = await editor.scorer.list();
    expect(list.total).toBe(2);

    // Config changes require createVersion + update(activeVersionId)
    const scorerStore = await storage.getStore('scorerDefinitions');
    await scorerStore!.createVersion({
      id: crypto.randomUUID(),
      scorerDefinitionId: 'lifecycle-1',
      versionNumber: 2,
      name: 'Updated Lifecycle 1',
      type: 'llm-judge',
      model: { provider: 'mock', name: 'scorer-model' },
      instructions: 'Test 1',
      changedFields: ['name'],
    });
    const latestVersion = await scorerStore!.getLatestVersion('lifecycle-1');
    await scorerStore!.update({ id: 'lifecycle-1', activeVersionId: latestVersion!.id, status: 'published' });
    editor.scorer.clearCache('lifecycle-1');

    const updatedDef = await editor.scorer.getById('lifecycle-1');
    expect(updatedDef?.name).toBe('Updated Lifecycle 1');

    await editor.scorer.delete('lifecycle-2');
    list = await editor.scorer.list();
    expect(list.total).toBe(1);
    expect(list.scorerDefinitions[0]?.id).toBe('lifecycle-1');

    const deleted = await editor.scorer.getById('lifecycle-2');
    expect(deleted).toBeNull();
  });

  it('should pick up updated scorer config when agent is re-fetched after scorer update', async () => {
    // Use two separate mock LLMs with different scores — v1 returns 0.6, v2 returns 0.95
    const { modelId: modelIdV1, mockLLM: mockLLMV1 } = createScorerMockLLM(0.6, 'Version 1 reason.');
    const { modelId: modelIdV2, mockLLM: mockLLMV2 } = createScorerMockLLM(0.95, 'Version 2 reason.');
    const gateway = new ScorerMockGateway();
    gateway.registerModel(modelIdV1, mockLLMV1);
    gateway.registerModel(modelIdV2, mockLLMV2);
    const mastra = new Mastra({ storage, editor, gateways: { 'models.dev': gateway } });
    await storage.init();

    // 1. Create a stored scorer definition (v1)
    await editor.scorer.create({
      id: 'updatable-scorer',
      name: 'Updatable Scorer v1',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelIdV1 },
      instructions: 'Version 1: rate quality.',
      scoreRange: { min: 0, max: 1 },
    });

    // 2. Create a stored agent that references the scorer
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-with-updatable-scorer',
        name: 'Agent With Updatable Scorer',
        instructions: 'You are a helpful assistant.',
        model: { provider: 'openai', name: 'gpt-4' },
        scorers: {
          'updatable-scorer': {},
        },
      },
    });

    // 3. Fetch agent, pull its scorer, and execute
    const agentV1 = await editor.agent.getById('agent-with-updatable-scorer');
    expect(agentV1).toBeInstanceOf(Agent);
    const scorersV1 = await agentV1?.listScorers();
    expect(Object.keys(scorersV1!)).toHaveLength(1);
    const scorerV1 = scorersV1!['updatable-scorer']!.scorer;
    expect(scorerV1.name).toBe('Updatable Scorer v1');

    const testRun = createAgentTestRun({
      inputMessages: [createTestMessage({ content: 'Hello', role: 'user', id: 'input-1' })],
      output: [createTestMessage({ content: 'Hi there!', role: 'assistant', id: 'output-1' })],
    });

    const resultV1 = await scorerV1.run(testRun);
    expect(resultV1.score).toBe(0.6);
    expect(resultV1.reason).toBe('Version 1 reason.');

    // 4. Update the scorer definition (v2) — config changes require createVersion + update(activeVersionId)
    const scorerStore = await storage.getStore('scorerDefinitions');
    await scorerStore!.createVersion({
      id: crypto.randomUUID(),
      scorerDefinitionId: 'updatable-scorer',
      versionNumber: 2,
      name: 'Updatable Scorer v2',
      type: 'llm-judge',
      model: { provider: 'mock', name: modelIdV2 },
      instructions: 'Version 2: rate quality more strictly.',
      scoreRange: { min: 0, max: 1 },
      changedFields: ['name', 'model', 'instructions'],
    });
    const latestVersion = await scorerStore!.getLatestVersion('updatable-scorer');
    await scorerStore!.update({ id: 'updatable-scorer', activeVersionId: latestVersion!.id, status: 'published' });
    editor.scorer.clearCache('updatable-scorer');

    // 5. Clear the cached agent so re-fetch picks up new scorer
    editor.agent.clearCache('agent-with-updatable-scorer');

    // 6. Re-fetch agent, pull its scorer, and execute — should use v2 config
    const agentV2 = await editor.agent.getById('agent-with-updatable-scorer');
    expect(agentV2).toBeInstanceOf(Agent);
    const scorersV2 = await agentV2?.listScorers();
    expect(Object.keys(scorersV2!)).toHaveLength(1);
    const scorerV2 = scorersV2!['updatable-scorer']!.scorer;
    expect(scorerV2.name).toBe('Updatable Scorer v2');

    const resultV2 = await scorerV2.run(testRun);
    expect(resultV2.score).toBe(0.95);
    expect(resultV2.reason).toBe('Version 2 reason.');
  });
});
