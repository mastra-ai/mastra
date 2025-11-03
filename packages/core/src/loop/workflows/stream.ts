import { ReadableStream } from 'stream/web';
import type { ToolSet } from 'ai-v5';
import { RequestContext } from '../../request-context';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { LoopRun } from '../types';
import { createAgenticLoopWorkflow } from './agentic-loop';

/**
 * Check if a ReadableStreamDefaultController is open and can accept data.
 *
 * Note: While the ReadableStream spec indicates desiredSize can be:
 * - positive (ready), 0 (full but open), or null (closed/errored),
 * our empirical testing shows that after controller.close(), desiredSize becomes 0.
 * Therefore, we treat both 0 and null as closed states to prevent
 * "Invalid state: Controller is already closed" errors.
 *
 * @param controller - The ReadableStreamDefaultController to check
 * @returns true if the controller is open and can accept data
 */
export function isControllerOpen(controller: ReadableStreamDefaultController<any>): boolean {
  return controller.desiredSize !== 0 && controller.desiredSize !== null;
}

export function workflowLoopStream<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  resumeContext,
  requireToolApproval,
  models,
  toolChoice,
  modelSettings,
  _internal,
  messageId,
  runId,
  messageList,
  startTimestamp,
  streamState,
  agentId,
  toolCallId,
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const writer = new WritableStream<ChunkType<OUTPUT>>({
        write: chunk => {
          controller.enqueue(chunk);
        },
      });

      const agenticLoopWorkflow = createAgenticLoopWorkflow<Tools, OUTPUT>({
        resumeContext,
        messageId: messageId!,
        models,
        _internal,
        modelSettings,
        toolChoice,
        controller,
        writer,
        runId,
        messageList,
        startTimestamp,
        streamState,
        agentId,
        ...rest,
      });

      if (rest.mastra) {
        agenticLoopWorkflow.__registerMastra(rest.mastra);
      }

      const initialData = {
        messageId: messageId!,
        messages: {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: [],
        },
        output: {
          steps: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        metadata: {},
        stepResult: {
          reason: 'undefined',
          warnings: [],
          isContinued: true,
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
      };

      if (!resumeContext) {
        controller.enqueue({
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: agentId,
          },
        });
      }

      const run = await agenticLoopWorkflow.createRun({
        runId,
      });

      const requestContext = new RequestContext();

      if (requireToolApproval) {
        requestContext.set('__mastra_requireToolApproval', true);
      }

      const executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext.resumeData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            label: toolCallId,
          })
        : await run.start({
            inputData: initialData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            requestContext,
          });

      if (executionResult.status !== 'success') {
        controller.close();
        return;
      }

      if (executionResult.result.stepResult?.reason === 'abort') {
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          ...executionResult.result,
          stepResult: {
            ...executionResult.result.stepResult,
            // @ts-ignore we add 'abort' for tripwires so the type is not compatible
            reason: executionResult.result.stepResult.reason,
          },
        },
      });

      controller.close();
    },
  });
}
