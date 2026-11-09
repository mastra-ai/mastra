import { describe, it, beforeEach, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { z } from 'zod/v4';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import { createToolCallStep } from './tool-call-step';

const createMessageList = () =>
  ({
    get: {
      input: { aiV5: { model: () => [] } },
      response: { db: () => [] },
      all: { db: () => [] },
    },
  }) as unknown as MessageList;

const inputData = { toolCallId: 'refund-call', toolName: 'issue_refund', args: { orderId: 'missing' } };

const makeExecuteParams = (suspend: Mock, overrides: any = {}) => ({
  runId: 'refund-run',
  workflowId: 'test-workflow-id',
  mastra: {} as any,
  requestContext: new RequestContext(),
  state: {},
  setState: vi.fn(),
  retryCount: 1,
  tracingContext: {} as any,
  getInitData: vi.fn(),
  getStepResult: vi.fn(),
  suspend,
  bail: vi.fn(),
  abort: vi.fn(),
  engine: 'default' as any,
  abortSignal: new AbortController().signal,
  validateSchemas: false,
  writer: new ToolStream({ prefix: 'tool', callId: 'refund-call', name: 'issue_refund', runId: 'refund-run' }),
  inputData,
  ...overrides,
});

describe('createToolCallStep beforeApproval hook (#26772)', () => {
  let controller: { enqueue: Mock };
  let suspend: Mock;

  beforeEach(() => {
    controller = { enqueue: vi.fn() };
    suspend = vi.fn().mockResolvedValue('suspended');
  });

  const makeStep = (tool: unknown, options: Record<string, unknown> = {}) =>
    createToolCallStep({
      tools: { issue_refund: tool } as any,
      messageList: createMessageList(),
      controller: controller as any,
      runId: 'refund-run',
      streamState: { serialize: vi.fn().mockReturnValue('serialized-state') } as any,
      ...options,
    });

  const approvalChunks = () =>
    controller.enqueue.mock.calls.map(([chunk]) => chunk).filter(chunk => chunk?.type === 'tool-call-approval');

  it('rejects the call with the hook output without suspending or executing', async () => {
    const execute = vi.fn();
    const beforeApproval = vi.fn().mockResolvedValue({ proceed: false, output: { error: 'Order missing not found' } });
    const step = makeStep({ execute, requireApproval: true, beforeApproval });

    const result = await step.execute(makeExecuteParams(suspend));

    expect(beforeApproval).toHaveBeenCalledWith(
      { orderId: 'missing' },
      expect.objectContaining({ toolCallId: 'refund-call', toolName: 'issue_refund' }),
    );
    expect(suspend).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(approvalChunks()).toHaveLength(0);
    expect(result).toEqual({ result: { error: 'Order missing not found' }, ...inputData });
  });

  it('continues to the approval gate when the hook returns nothing', async () => {
    const execute = vi.fn();
    const beforeApproval = vi.fn().mockResolvedValue(undefined);
    const step = makeStep({ execute, requireApproval: true, beforeApproval });

    const result = await step.execute(makeExecuteParams(suspend));

    expect(beforeApproval).toHaveBeenCalledTimes(1);
    expect(result).toBe('suspended');
    expect(suspend).toHaveBeenCalledTimes(1);
    expect(approvalChunks()).toHaveLength(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it('continues to the approval gate when the hook throws', async () => {
    const execute = vi.fn();
    const beforeApproval = vi.fn().mockRejectedValue(new Error('backend down'));
    const step = makeStep({ execute, requireApproval: true, beforeApproval });

    const result = await step.execute(makeExecuteParams(suspend));

    expect(result).toBe('suspended');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not run for calls that do not require approval', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const beforeApproval = vi.fn().mockResolvedValue({ proceed: false, output: 'rejected' });
    const step = makeStep({ execute, beforeApproval });

    const result = await step.execute(makeExecuteParams(suspend));

    expect(beforeApproval).not.toHaveBeenCalled();
    expect(result).toEqual({ result: { ok: true }, ...inputData });
  });

  it('runs when approval is required by the agent-level requireToolApproval policy', async () => {
    const execute = vi.fn();
    const beforeApproval = vi.fn().mockReturnValue({ proceed: false, output: 'rejected' });
    const step = makeStep({ execute, beforeApproval }, { requireToolApproval: true });

    const result = await step.execute(makeExecuteParams(suspend));

    expect(suspend).not.toHaveBeenCalled();
    expect(result).toEqual({ result: 'rejected', ...inputData });
  });

  it('does not run when resuming from the approval suspension', async () => {
    const execute = vi.fn().mockResolvedValue({ refunded: true });
    const beforeApproval = vi.fn().mockReturnValue({ proceed: false, output: 'rejected' });
    const step = makeStep({ execute, requireApproval: true, beforeApproval });

    const result = await step.execute(
      makeExecuteParams(suspend, {
        resumeData: { approved: true },
        suspendData: { requireToolApproval: { ...inputData } },
      }),
    );

    expect(beforeApproval).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ result: { refunded: true }, approval: { approved: true } });
  });

  it('is carried from createTool through CoreToolBuilder', async () => {
    const execute = vi.fn();
    const tool = createTool({
      id: 'issue_refund',
      description: 'Issue a refund',
      inputSchema: z.object({ orderId: z.string() }),
      requireApproval: true,
      beforeApproval: async ({ orderId }) => ({ proceed: false, output: `Order ${orderId} not found` }),
      execute,
    });
    const coreTool = new CoreToolBuilder({
      originalTool: tool,
      options: {
        name: 'issue_refund',
        requestContext: new RequestContext(),
        requireApproval: tool.requireApproval,
      } as any,
    }).build();

    const result = await makeStep(coreTool).execute(makeExecuteParams(suspend));

    expect(suspend).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(result).toEqual({ result: 'Order missing not found', ...inputData });
  });

  describe('input passed to the hook from a createTool schema', () => {
    const buildRefundTool = (beforeApproval: Mock) => {
      const tool = createTool({
        id: 'issue_refund',
        description: 'Issue a refund',
        inputSchema: z.object({ orderId: z.string(), amount: z.number().default(5) }),
        requireApproval: true,
        beforeApproval,
        execute: vi.fn(),
      });
      return new CoreToolBuilder({
        originalTool: tool,
        options: { name: 'issue_refund', requestContext: new RequestContext(), requireApproval: true } as any,
      }).build();
    };

    it('receives schema-parsed input with defaults applied', async () => {
      const beforeApproval = vi.fn().mockResolvedValue(undefined);

      await makeStep(buildRefundTool(beforeApproval)).execute(
        makeExecuteParams(suspend, { inputData: { ...inputData, args: { orderId: 'a' } } }),
      );

      expect(beforeApproval).toHaveBeenCalledWith({ orderId: 'a', amount: 5 }, expect.anything());
    });

    it('rejects input that fails the schema before the approval gate, without running the hook (#26771)', async () => {
      const beforeApproval = vi.fn().mockResolvedValue({ proceed: false, output: 'rejected' });

      const result = (await makeStep(buildRefundTool(beforeApproval)).execute(
        makeExecuteParams(suspend, { inputData: { ...inputData, args: { orderId: 123 } } }),
      )) as any;

      expect(beforeApproval).not.toHaveBeenCalled();
      expect(suspend).not.toHaveBeenCalled();
      expect(approvalChunks()).toHaveLength(0);
      expect(result.result).toMatchObject({ error: true, message: expect.stringContaining('orderId') });
    });

    it('rejects invalid input before the approval gate for tools without a hook (#26771)', async () => {
      const tool = new CoreToolBuilder({
        originalTool: createTool({
          id: 'issue_refund',
          description: 'Issue a refund',
          inputSchema: z.object({ amount: z.number() }),
          requireApproval: true,
          execute: vi.fn(),
        }),
        options: { name: 'issue_refund', requestContext: new RequestContext(), requireApproval: true } as any,
      }).build();

      const result = (await makeStep(tool).execute(
        makeExecuteParams(suspend, { inputData: { ...inputData, args: { amount: 'not-a-number' } } }),
      )) as any;

      expect(suspend).not.toHaveBeenCalled();
      expect(approvalChunks()).toHaveLength(0);
      expect(result.result).toMatchObject({ error: true, message: expect.stringContaining('amount') });
    });
  });
});
