import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { MessageList } from '../../../agent/message-list';
import { RequestContext } from '../../../request-context';
import { createTool } from '../../../tools';
import { ToolStream } from '../../../tools/stream';
import { CoreToolBuilder } from '../../../tools/tool-builder/builder';
import { createStep } from '../../../workflows/workflow';
import { toolCallOutputSchema } from '../schema';
import { createLLMMappingStep } from './llm-mapping-step';
import { createToolCallStep } from './tool-call-step';

// Composed regression test for #17995: runs the REAL tool-call-step under an aborted
// request signal, passes its output through the REAL step output schema (the evented
// engine validates/strips step outputs against toolCallOutputSchema), then feeds it
// into the REAL llm-mapping-step. Pre-fix, the pipeline produced `{ error }` which the
// mapping step recorded as a completed `output-error` invocation — a fabricated
// completion whose text was the abort message. The unit tests in tool-call-step.test.ts
// and llm-mapping-step.test.ts each pin one half of this chain; this test pins the
// composition so neither half can silently regress against the other's expectations.
describe('aborted tool call pipeline (tool-call-step → schema boundary → llm-mapping-step)', () => {
  it('leaves the call unrecorded end-to-end when the request abort interrupts the tool', async () => {
    // -- Real tool that throws mid-flight, as fetch/etc. do when the request aborts.
    const abortedTool = createTool({
      id: 'slow-server-tool',
      description: 'A server tool cancelled by request abort',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        throw err;
      },
    });

    const builtTool = new CoreToolBuilder({
      originalTool: abortedTool,
      options: {
        name: 'slow-server-tool',
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() } as any,
        description: 'A server tool cancelled by request abort',
        requestContext: new RequestContext(),
      },
    }).build();

    // Single messageList shared by both steps, as in a real run.
    const updateToolInvocation = vi.fn();
    const messageList = {
      get: {
        input: { aiV5: { model: () => [] } },
        response: { db: () => [], aiV5: { model: () => [] } },
        all: { db: () => [], aiV5: { model: () => [] } },
      },
      add: vi.fn(),
      updateToolInvocation,
    } as unknown as MessageList;

    const controller = { enqueue: vi.fn() };
    const streamState = { serialize: vi.fn().mockReturnValue('serialized-state') };

    const abortController = new AbortController();
    abortController.abort();

    // -- Step 1: real tool-call-step with the aborted agent-run signal wired in.
    const toolCallStep = createToolCallStep({
      tools: { 'slow-server-tool': builtTool },
      messageList,
      controller,
      runId: 'test-run',
      streamState,
      options: { abortSignal: abortController.signal },
    } as any);

    const baseParams = {
      runId: 'test-run',
      workflowId: 'test-workflow',
      mastra: {} as any,
      requestContext: new RequestContext(),
      state: {},
      setState: vi.fn(),
      retryCount: 1,
      tracingContext: {} as any,
      getInitData: vi.fn(),
      abort: vi.fn(),
      engine: 'default' as any,
      abortSignal: new AbortController().signal,
      writer: new ToolStream({
        prefix: 'tool',
        callId: 'call-1',
        name: 'slow-server-tool',
        runId: 'test-run',
      }),
      validateSchemas: false,
    };

    const toolCallOutput = await toolCallStep.execute({
      ...baseParams,
      suspend: vi.fn(),
      bail: vi.fn(),
      getStepResult: vi.fn(),
      inputData: {
        toolCallId: 'call-1',
        toolName: 'slow-server-tool',
        args: { q: 'important' },
      },
    } as any);

    // -- Schema boundary: the evented engine parses step output against the declared
    // schema, stripping undeclared keys. `aborted` must survive this pass or the
    // mapping step can't distinguish the call from a pending HITL tool. (Asserted at
    // the end so a pre-fix run fails on the persistence assertions — the actual bug.)
    const crossedBoundary = toolCallOutputSchema.parse(toolCallOutput);

    // -- Step 2: real llm-mapping-step consuming the parsed output.
    const llmExecutionStep = createStep({
      id: 'test-llm-execution',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async () => ({
        stepResult: { isContinued: true, reason: undefined },
        metadata: {},
      }),
    });

    const bail = vi.fn(data => data);
    const llmMappingStep = createLLMMappingStep(
      {
        models: {} as any,
        controller,
        messageList,
        runId: 'test-run',
        _internal: { generateId: () => 'test-message-id' },
      } as any,
      llmExecutionStep,
    );

    const result: any = await llmMappingStep.execute({
      ...baseParams,
      suspend: vi.fn(),
      bail,
      getStepResult: vi.fn(() => ({
        stepResult: { isContinued: true, reason: undefined },
        metadata: {},
      })),
      inputData: [crossedBoundary],
    } as any);

    // Nothing persisted: the message history is never updated for the aborted call —
    // no fabricated success, no output-error whose text is the abort message.
    expect(updateToolInvocation).not.toHaveBeenCalled();
    // No result/error chunks reach the stream for the aborted call.
    expect(controller.enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool-result' }));
    expect(controller.enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'tool-error' }));
    // The loop ends, leaving the call incomplete rather than continuing on a fake result.
    expect(bail).toHaveBeenCalled();
    expect(result.stepResult.isContinued).toBe(false);
    // And the abort marker itself survived the schema boundary intact.
    expect(crossedBoundary.aborted).toBe(true);
    expect(crossedBoundary).not.toHaveProperty('result');
    expect(crossedBoundary.error).toBeUndefined();
  });
});
