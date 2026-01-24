import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTarget } from '../executor';
import type { Agent } from '../../../agent';
import type { Workflow } from '../../../workflows';

// Mock the isSupportedLanguageModel import
vi.mock('../../../agent', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    isSupportedLanguageModel: vi.fn().mockReturnValue(true),
  };
});

// Import after mock setup for module-level mocking
import { isSupportedLanguageModel } from '../../../agent';

// Helper to create mock agent
const createMockAgent = (response: string, shouldFail = false): Agent => ({
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
const createMockWorkflow = (result: Record<string, unknown>): Workflow => ({
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
        expectedOutput: null,
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
        expectedOutput: null,
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
        expectedOutput: null,
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
        expectedOutput: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toBe('Agent error');
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
        expectedOutput: null,
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
        expectedOutput: null,
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
        expectedOutput: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toBe('Workflow failed');
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
        expectedOutput: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toBe('Workflow tripwire: Limit exceeded');
    });

    it('returns not-yet-supported error on suspended status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-4',
        datasetId: 'ds-1',
        input: { data: 'test' },
        expectedOutput: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toBe('Workflow suspended - not yet supported in dataset runs');
    });

    it('returns not-yet-supported error on paused status', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'paused',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-5',
        datasetId: 'ds-1',
        input: { data: 'test' },
        expectedOutput: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toBe('Workflow paused - not yet supported in dataset runs');
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
        expectedOutput: null,
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
        expectedOutput: null,
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
});
