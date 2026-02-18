import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent } from '../../../agent';
import type { Workflow } from '../../../workflows';
import { executeTarget } from '../executor';

// Mock the isSupportedLanguageModel import
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Import after mock setup for module-level mocking
// eslint-disable-next-line import/order
import { isSupportedLanguageModel } from '../../../agent';

// Helper to create mock agent
const createMockAgent = (response: string, shouldFail = false): Agent =>
  ({
    id: 'test-agent',
    name: 'Test Agent',
    getModel: vi.fn().mockResolvedValue({ specificationVersion: 'v2' }),
    generate: vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error('Agent error');
      }
      return { text: response };
    }),
  }) as unknown as Agent;

// Helper to create mock workflow
const createMockWorkflow = (result: Record<string, unknown>): Workflow =>
  ({
    id: 'test-workflow',
    name: 'Test Workflow',
    createRun: vi.fn().mockImplementation(async () => ({
      start: vi.fn().mockResolvedValue(result),
    })),
  }) as unknown as Workflow;

describe('executeTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('agent target', () => {
    it('handles string input and returns FullOutput', async () => {
      const mockAgent = createMockAgent('Hello response');

      const result = await executeTarget(mockAgent, 'agent', {
        id: 'item-1',
        datasetId: 'ds-1',
        input: 'Hello',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ text: 'Hello response' });
      expect(result.error).toBeNull();
      expect(mockAgent.generate).toHaveBeenCalledWith('Hello', {
        scorers: {},
        returnScorerData: true,
      });
    });

    it('handles messages array input and returns FullOutput', async () => {
      const mockAgent = createMockAgent('Hi response');
      const messagesInput = [{ role: 'user', content: 'Hi' }];

      const result = await executeTarget(mockAgent, 'agent', {
        id: 'item-2',
        datasetId: 'ds-1',
        input: messagesInput,
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ text: 'Hi response' });
      expect(result.error).toBeNull();
      expect(mockAgent.generate).toHaveBeenCalledWith(messagesInput, {
        scorers: {},
        returnScorerData: true,
      });
    });

    it('handles empty string input (passed through to agent)', async () => {
      const mockAgent = createMockAgent('Empty response');

      const result = await executeTarget(mockAgent, 'agent', {
        id: 'item-3',
        datasetId: 'ds-1',
        input: '',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ text: 'Empty response' });
      expect(result.error).toBeNull();
      // Verify empty string is passed through - agent decides behavior
      expect(mockAgent.generate).toHaveBeenCalledWith('', {
        scorers: {},
        returnScorerData: true,
      });
    });

    it('captures error as string when agent throws', async () => {
      const mockAgent = createMockAgent('', true);

      const result = await executeTarget(mockAgent, 'agent', {
        id: 'item-4',
        datasetId: 'ds-1',
        input: 'Test',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Agent error' }));
    });

    it('uses generateLegacy when model is not supported', async () => {
      // Override mock for this test
      vi.mocked(isSupportedLanguageModel).mockReturnValue(false);

      const mockAgent = {
        ...createMockAgent('Legacy response'),
        generateLegacy: vi.fn().mockResolvedValue({ text: 'Legacy response' }),
      };

      const result = await executeTarget(mockAgent as unknown as Agent, 'agent', {
        id: 'item-5',
        datasetId: 'ds-1',
        input: 'Test',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ text: 'Legacy response' });
      expect(result.error).toBeNull();
      expect(mockAgent.generateLegacy).toHaveBeenCalledWith('Test', {
        scorers: {},
        returnScorerData: true,
      });

      // Reset mock
      vi.mocked(isSupportedLanguageModel).mockReturnValue(true);
    });
  });

  describe('workflow target', () => {
    it('returns result on success status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'success',
        result: { answer: 'Workflow result' },
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-1',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ answer: 'Workflow result' });
      expect(result.error).toBeNull();
    });

    it('captures error on failed status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'failed',
        error: { message: 'Workflow failed' },
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-2',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Workflow failed' }));
    });

    it('captures tripwire reason on tripwire status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'tripwire',
        tripwire: { reason: 'Limit exceeded' },
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-3',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Workflow tripwire: Limit exceeded' }));
    });

    it('returns not-yet-supported error on suspended status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-4',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(
        expect.objectContaining({ message: 'Workflow suspended - not yet supported in dataset experiments' }),
      );
    });

    it('returns not-yet-supported error on paused status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'paused',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-5',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(
        expect.objectContaining({ message: 'Workflow paused - not yet supported in dataset experiments' }),
      );
    });

    it('handles empty object input', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'success',
        result: { processed: true },
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-6',
        datasetId: 'ds-1',
        input: {},
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ processed: true });
      expect(result.error).toBeNull();
    });
  });

  describe('v1 limitations', () => {
    it('does not pass request context to agent (v1 limitation)', async () => {
      // CONTEXT.md explicitly defers: "Runtime context propagation (auth, headers) - add when needed"
      // This test documents the v1 behavior for traceability
      const mockAgent = createMockAgent('Response');

      await executeTarget(mockAgent, 'agent', {
        id: 'item-1',
        datasetId: 'ds-1',
        input: 'Test',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        // Any context field here is NOT passed to generate()
      });

      // Verify generate was called without context parameter
      expect(mockAgent.generate).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({ scorers: {}, returnScorerData: true }),
      );
      // Verify the options object does NOT have a context field
      const callArgs = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('context');
    });
  });

  describe('scorer target', () => {
    // Helper to create mock scorer
    const createMockScorer = (score: number, reason?: string, shouldFail = false) => ({
      id: 'test-scorer',
      name: 'Test Scorer',
      run: vi.fn().mockImplementation(async () => {
        if (shouldFail) throw new Error('Scorer error');
        return { score, reason };
      }),
    });

    it('calls scorer.run with item.input directly', async () => {
      const mockScorer = createMockScorer(0.85, 'Good answer');
      // item.input contains exactly what scorer expects (user structures it)
      const scorerInput = {
        input: { question: 'What is 2+2?' },
        output: { response: '4' },
        groundTruth: { score: 1.0, label: 'correct' },
      };

      const result = await executeTarget(mockScorer as any, 'scorer', {
        id: 'item-1',
        datasetId: 'ds-1',
        input: scorerInput, // Full scorer input in item.input
        groundTruth: { humanScore: 1.0 }, // Human label for alignment analysis
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Scorer receives item.input directly - no field mapping
      expect(mockScorer.run).toHaveBeenCalledWith(scorerInput);
      expect(result.output).toEqual({ score: 0.85, reason: 'Good answer' });
      expect(result.error).toBeNull();
    });

    it('returns null score and warns on NaN score', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockScorer = createMockScorer(NaN, 'Invalid');

      const result = await executeTarget(mockScorer as any, 'scorer', {
        id: 'item-2',
        datasetId: 'ds-1',
        input: { output: 'test response' },
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ score: null, reason: 'Invalid' });
      expect(result.error).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('invalid score'));
      consoleSpy.mockRestore();
    });

    it('returns null score and warns on non-number score', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockScorer = {
        id: 'test-scorer',
        name: 'Test Scorer',
        run: vi.fn().mockResolvedValue({ score: 'not-a-number', reason: 'Bad type' }),
      };

      const result = await executeTarget(mockScorer as any, 'scorer', {
        id: 'item-3',
        datasetId: 'ds-1',
        input: { output: 'test' },
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ score: null, reason: 'Bad type' });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('captures error when scorer throws', async () => {
      const mockScorer = createMockScorer(0, '', true);

      const result = await executeTarget(mockScorer as any, 'scorer', {
        id: 'item-4',
        datasetId: 'ds-1',
        input: { output: 'test' },
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Scorer error' }));
    });

    it('handles null reason in scorer result', async () => {
      const mockScorer = {
        id: 'test-scorer',
        name: 'Test Scorer',
        run: vi.fn().mockResolvedValue({ score: 0.7, reason: null }),
      };

      const result = await executeTarget(mockScorer as any, 'scorer', {
        id: 'item-5',
        datasetId: 'ds-1',
        input: { output: 'response' },
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ score: 0.7, reason: null });
    });
  });
});
