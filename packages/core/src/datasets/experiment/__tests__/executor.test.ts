import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent } from '../../../agent';
import { RequestContext } from '../../../request-context';
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
const createMockWorkflow = (result: Record<string, unknown>, resumeResults?: Record<string, unknown>[]): Workflow => {
  const resumeMock = vi.fn();
  if (resumeResults) {
    for (const r of resumeResults) {
      resumeMock.mockResolvedValueOnce(r);
    }
  }
  return {
    id: 'test-workflow',
    name: 'Test Workflow',
    createRun: vi.fn().mockImplementation(async () => ({
      start: vi.fn().mockResolvedValue(result),
      resume: resumeMock,
    })),
  } as unknown as Workflow;
};

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

      expect(result.output).toEqual(expect.objectContaining({ text: 'Hello response' }));
      expect(result.error).toBeNull();
      expect(mockAgent.generate).toHaveBeenCalledWith('Hello', {
        scorers: {},
        returnScorerData: true,
      });
    });

    it('passes requestContext to agent.generate as a RequestContext instance', async () => {
      const mockAgent = createMockAgent('Hello response');

      await executeTarget(
        mockAgent,
        'agent',
        {
          id: 'item-1',
          datasetId: 'ds-1',
          input: 'Hello',
          groundTruth: null,
          version: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { requestContext: { userId: 'dev-user-123', environment: 'development' } },
      );

      expect(mockAgent.generate).toHaveBeenCalledTimes(1);
      const callArgs = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0];
      const options = callArgs[1];

      // requestContext should be a RequestContext instance
      expect(options.requestContext).toBeInstanceOf(RequestContext);
      // It should contain the values we passed
      expect(options.requestContext.all).toEqual({ userId: 'dev-user-123', environment: 'development' });
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

      expect(result.output).toEqual(expect.objectContaining({ text: 'Hi response' }));
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

      expect(result.output).toEqual(expect.objectContaining({ text: 'Empty response' }));
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

    it('preserves structured abort identity without parsing the message', async () => {
      const mockAgent = {
        ...createMockAgent(''),
        generate: vi.fn().mockRejectedValue(new DOMException('Stopped by caller', 'AbortError')),
      };

      const result = await executeTarget(mockAgent as unknown as Agent, 'agent', {
        id: 'item-abort',
        datasetId: 'ds-1',
        input: 'Test',
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.error).toEqual(expect.objectContaining({ message: 'Stopped by caller', code: 'AbortError' }));
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

      expect(result.output).toEqual(expect.objectContaining({ text: 'Legacy response' }));
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

    it('returns suspended error with guidance when no resume data provided', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
        suspendPayload: { prompt: 'Approve?' },
        suspended: [['approval-step']],
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

      // suspend payload exposed as output for debugging
      expect(result.output).toEqual({ prompt: 'Approve?' });
      expect(result.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('provide resume data'),
        }),
      );
    });

    it('auto-resumes suspended workflow with flat resumeData', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['approval-step']],
          suspendPayload: { prompt: 'Approve?' },
          steps: {},
          traceId: 'trace-1',
          spanId: 'span-1',
        },
        [
          {
            status: 'success',
            result: { approved: true },
            steps: {},
            traceId: 'trace-1',
            spanId: 'span-1',
            stepExecutionPath: ['approval-step'],
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-1',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { approved: true },
      });

      expect(result.error).toBeNull();
      expect(result.output).toEqual({ approved: true });

      // Verify resume was called with correct args
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledTimes(1);
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { approved: true },
          step: 'approval-step',
        }),
      );
    });

    it('auto-resumes suspended workflow with per-step resumeSteps', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['review-step']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-2',
          spanId: 'span-2',
        },
        [
          {
            status: 'success',
            result: { reviewed: true },
            steps: {},
            traceId: 'trace-2',
            spanId: 'span-2',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-2',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'review-step': { decision: 'approve' } },
      });

      expect(result.error).toBeNull();
      expect(result.output).toEqual({ reviewed: true });

      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { decision: 'approve' },
          step: 'review-step',
        }),
      );
    });

    it('auto-resumes through multiple suspend/resume cycles', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-a']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-3',
          spanId: 'span-3',
        },
        [
          {
            status: 'suspended',
            suspended: [['step-b']],
            suspendPayload: {},
            steps: {},
            traceId: 'trace-3',
            spanId: 'span-3',
          },
          {
            status: 'success',
            result: { done: true },
            steps: {},
            traceId: 'trace-3',
            spanId: 'span-3',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-3',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: {
          'step-a': { value: 'a' },
          'step-b': { value: 'b' },
        },
      });

      expect(result.error).toBeNull();
      expect(result.output).toEqual({ done: true });

      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledTimes(2);
    });

    it('stops resuming when no data matches the suspended step', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
        suspended: [['unknown-step']],
        suspendPayload: { prompt: 'Input needed' },
        steps: {},
        traceId: 'trace-4',
        spanId: 'span-4',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-4',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'other-step': { value: 'x' } },
      });

      // Should still be suspended — no matching resume data
      expect(result.output).toEqual({ prompt: 'Input needed' });
      expect(result.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('provide resume data'),
        }),
      );
    });

    it('reads resume data from metadata fallback', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['approval-step']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-5',
          spanId: 'span-5',
        },
        [
          {
            status: 'success',
            result: { ok: true },
            steps: {},
            traceId: 'trace-5',
            spanId: 'span-5',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-5',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { resumeData: { approved: true } },
      });

      expect(result.error).toBeNull();
      expect(result.output).toEqual({ ok: true });
    });

    it('reads resume data from metadata.resumeSteps fallback', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['review-step']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-meta-steps',
          spanId: 'span-meta-steps',
        },
        [
          {
            status: 'success',
            result: { reviewed: true },
            steps: {},
            traceId: 'trace-meta-steps',
            spanId: 'span-meta-steps',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-meta-steps',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { resumeSteps: { 'review-step': { decision: 'approve' } } },
      });

      expect(result.error).toBeNull();
      expect(result.output).toEqual({ reviewed: true });

      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { decision: 'approve' },
          step: 'review-step',
        }),
      );
    });

    it('top-level resumeSteps takes precedence over metadata.resumeSteps', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-1']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-prec',
          spanId: 'span-prec',
        },
        [
          {
            status: 'success',
            result: { source: 'top-level' },
            steps: {},
            traceId: 'trace-prec',
            spanId: 'span-prec',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-prec',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'step-1': { from: 'top-level' } },
        metadata: { resumeSteps: { 'step-1': { from: 'metadata' } } },
      });

      expect(result.error).toBeNull();
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { from: 'top-level' },
        }),
      );
    });

    it('top-level resumeData takes precedence over metadata.resumeData', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-1']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-flat-prec',
          spanId: 'span-flat-prec',
        },
        [
          {
            status: 'success',
            result: { ok: true },
            steps: {},
            traceId: 'trace-flat-prec',
            spanId: 'span-flat-prec',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-flat-prec',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { from: 'top-level' },
        metadata: { resumeData: { from: 'metadata' } },
      });

      expect(result.error).toBeNull();
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { from: 'top-level' },
        }),
      );
    });

    it('per-step resumeSteps takes precedence over flat resumeData for matching step', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['approval-step']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-step-vs-flat',
          spanId: 'span-step-vs-flat',
        },
        [
          {
            status: 'success',
            result: { used: 'per-step' },
            steps: {},
            traceId: 'trace-step-vs-flat',
            spanId: 'span-step-vs-flat',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-step-vs-flat',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'approval-step': { from: 'per-step' } },
        resumeData: { from: 'flat' },
      });

      expect(result.error).toBeNull();
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { from: 'per-step' },
        }),
      );
    });

    it('falls back to flat resumeData when resumeSteps has no entry for suspended step', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-x']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-fallback',
          spanId: 'span-fallback',
        },
        [
          {
            status: 'success',
            result: { used: 'flat' },
            steps: {},
            traceId: 'trace-fallback',
            spanId: 'span-fallback',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-fallback',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'other-step': { value: 'irrelevant' } },
        resumeData: { from: 'flat-fallback' },
      });

      expect(result.error).toBeNull();
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { from: 'flat-fallback' },
          step: 'step-x',
        }),
      );
    });

    it('caps resume cycles at MAX_RESUME_CYCLES to prevent infinite loops', async () => {
      // Create a workflow that always re-suspends on resume
      const alwaysSuspend = {
        status: 'suspended',
        suspended: [['loop-step']],
        suspendPayload: {},
        steps: {},
        traceId: 'trace-cap',
        spanId: 'span-cap',
      };
      // Generate 11 resume results that all re-suspend
      const resumeResults = Array.from({ length: 11 }, () => ({ ...alwaysSuspend }));
      const mockWorkflow = createMockWorkflow(alwaysSuspend, resumeResults);

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-cap',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { value: 'keep-going' },
      });

      // After 10 cycles, should stop and return suspended status
      expect(result.output).toEqual({});
      expect(result.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('provide resume data'),
        }),
      );

      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).toHaveBeenCalledTimes(10);
    });

    it('handles resume returning failed status', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-1']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-fail',
          spanId: 'span-fail',
        },
        [
          {
            status: 'failed',
            error: { message: 'Resume failed', stack: 'stack trace' },
            steps: { 'step-1': { status: 'failed' } },
            traceId: 'trace-fail',
            spanId: 'span-fail',
            stepExecutionPath: ['step-1'],
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-fail',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { approved: true },
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Resume failed' }));
      expect(result.stepResults).toEqual({ 'step-1': { status: 'failed' } });
    });

    it('handles resume returning tripwire status', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-1']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-trip',
          spanId: 'span-trip',
        },
        [
          {
            status: 'tripwire',
            tripwire: { reason: 'Token limit exceeded' },
            steps: {},
            traceId: 'trace-trip',
            spanId: 'span-trip',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-trip',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { approved: true },
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Workflow tripwire: Token limit exceeded' }));
    });

    it('handles empty suspended array by stopping resume loop', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
        suspended: [],
        suspendPayload: { prompt: 'Waiting' },
        steps: {},
        traceId: 'trace-empty',
        spanId: 'span-empty',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-empty-suspended',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { value: 'should-not-use' },
      });

      // Should return suspended because suspended array is empty — can't determine step to resume
      expect(result.output).toEqual({ prompt: 'Waiting' });
      expect(result.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('provide resume data'),
        }),
      );

      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      expect(run.resume).not.toHaveBeenCalled();
    });

    it('handles falsy but defined resume data values (null, false, 0, empty string)', async () => {
      // Falsy values like `false`, `0`, `null`, `""` should still be forwarded as valid resume payloads
      const falsyValues = [false, 0, null, ''];

      for (const falsyValue of falsyValues) {
        const mockWorkflow = createMockWorkflow(
          {
            status: 'suspended',
            suspended: [['confirm-step']],
            suspendPayload: {},
            steps: {},
            traceId: 'trace-falsy',
            spanId: 'span-falsy',
          },
          [
            {
              status: 'success',
              result: { received: falsyValue },
              steps: {},
              traceId: 'trace-falsy',
              spanId: 'span-falsy',
            },
          ],
        );

        const result = await executeTarget(mockWorkflow, 'workflow', {
          id: `item-falsy-${String(falsyValue)}`,
          datasetId: 'ds-1',
          input: { data: 'test' },
          groundTruth: null,
          version: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          resumeData: falsyValue,
        });

        expect(result.error).toBeNull();
        const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
        expect(run.resume).toHaveBeenCalledWith(
          expect.objectContaining({
            resumeData: falsyValue,
            step: 'confirm-step',
          }),
        );
      }
    });

    it('resumes only the first suspended step when multiple paths are suspended', async () => {
      const mockWorkflow = createMockWorkflow(
        {
          status: 'suspended',
          suspended: [['step-a', 'nested'], ['step-b']],
          suspendPayload: {},
          steps: {},
          traceId: 'trace-multi',
          spanId: 'span-multi',
        },
        [
          {
            status: 'success',
            result: { done: true },
            steps: {},
            traceId: 'trace-multi',
            spanId: 'span-multi',
          },
        ],
      );

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-multi-path',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeSteps: { 'step-a': { value: 'a' }, 'step-b': { value: 'b' } },
      });

      expect(result.error).toBeNull();
      const run = await (mockWorkflow.createRun as ReturnType<typeof vi.fn>).mock.results[0].value;
      // Only the first suspended path's first step should be resumed
      expect(run.resume).toHaveBeenCalledTimes(1);
      expect(run.resume).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeData: { value: 'a' },
          step: 'step-a',
        }),
      );
    });

    it('forwards requestContext through resume calls', async () => {
      const resumeMock = vi.fn().mockResolvedValue({
        status: 'success',
        result: { done: true },
        steps: {},
        traceId: 'trace-ctx',
        spanId: 'span-ctx',
      });
      const startMock = vi.fn().mockResolvedValue({
        status: 'suspended',
        suspended: [['step-1']],
        suspendPayload: {},
        steps: {},
        traceId: 'trace-ctx',
        spanId: 'span-ctx',
      });
      const mockWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        createRun: vi.fn().mockResolvedValue({
          start: startMock,
          resume: resumeMock,
        }),
      } as unknown as Workflow;

      await executeTarget(
        mockWorkflow,
        'workflow',
        {
          id: 'item-ctx',
          datasetId: 'ds-1',
          input: { data: 'test' },
          groundTruth: null,
          version: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          resumeData: { approved: true },
        },
        { requestContext: { tenantId: 'tenant-1' } },
      );

      expect(resumeMock).toHaveBeenCalledTimes(1);
      const resumeArgs = resumeMock.mock.calls[0][0];
      expect(resumeArgs.requestContext).toBeInstanceOf(RequestContext);
      expect(resumeArgs.requestContext.all).toEqual({ tenantId: 'tenant-1' });
      expect(resumeArgs).toHaveProperty('tracing');
      expect(resumeArgs).toHaveProperty('tracingContext');
    });

    it('handles run.resume() throwing an error', async () => {
      const resumeMock = vi.fn().mockRejectedValue(new Error('Resume network error'));
      const startMock = vi.fn().mockResolvedValue({
        status: 'suspended',
        suspended: [['step-1']],
        suspendPayload: {},
        steps: {},
      });
      const mockWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        createRun: vi.fn().mockResolvedValue({
          start: startMock,
          resume: resumeMock,
        }),
      } as unknown as Workflow;

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-resume-error',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        resumeData: { approved: true },
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(expect.objectContaining({ message: 'Resume network error' }));
    });

    it('returns null output when suspended with no suspendPayload', async () => {
      const mockWorkflow = createMockWorkflow({
        status: 'suspended',
        suspended: [['step-1']],
        steps: {},
        traceId: 'trace-null-payload',
        spanId: 'span-null-payload',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-null-payload',
        datasetId: 'ds-1',
        input: { data: 'test' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toBeNull();
      expect(result.error).toEqual(
        expect.objectContaining({
          message: expect.stringContaining('provide resume data'),
        }),
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

    it('surfaces stepResults, stepExecutionPath and spanId from a successful run', async () => {
      const stepResults = {
        chat: { status: 'success', payload: { prompt: 'hi' }, output: { text: 'hello' } },
      };
      const mockWorkflow = createMockWorkflow({
        status: 'success',
        result: { text: 'hello' },
        steps: stepResults,
        stepExecutionPath: ['chat'],
        traceId: 'trace-1',
        spanId: 'span-1',
      });

      const result = await executeTarget(mockWorkflow, 'workflow', {
        id: 'item-7',
        datasetId: 'ds-1',
        input: { prompt: 'hi' },
        groundTruth: null,
        version: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(result.output).toEqual({ text: 'hello' });
      expect(result.stepResults).toEqual(stepResults);
      expect(result.stepExecutionPath).toEqual(['chat']);
      expect(result.traceId).toBe('trace-1');
      expect(result.spanId).toBe('span-1');
    });

    it('forwards requestContext and observability context into run.start', async () => {
      const startSpy = vi.fn().mockResolvedValue({ status: 'success', result: {}, steps: {} });
      const mockWorkflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        createRun: vi.fn().mockResolvedValue({ start: startSpy }),
      } as unknown as Workflow;

      await executeTarget(
        mockWorkflow,
        'workflow',
        {
          id: 'item-8',
          datasetId: 'ds-1',
          input: { prompt: 'hi' },
          groundTruth: null,
          version: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        { requestContext: { tenantId: 't-1' } },
      );

      expect(startSpy).toHaveBeenCalledTimes(1);
      const startArgs = startSpy.mock.calls[0][0];
      expect(startArgs.inputData).toEqual({ prompt: 'hi' });
      expect(startArgs.requestContext).toBeInstanceOf(RequestContext);
      expect(startArgs.requestContext.all).toEqual({ tenantId: 't-1' });
      // Observability context fields are spread in (no-op when item carries no tracing context)
      expect(startArgs).toHaveProperty('tracing');
      expect(startArgs).toHaveProperty('tracingContext');
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
