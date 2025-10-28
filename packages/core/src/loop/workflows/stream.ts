import { ReadableStream } from 'stream/web';
import type { ToolSet } from 'ai-v5';
import { RuntimeContext } from '../../runtime-context';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { LoopRun } from '../types';
import type { createAgenticLoopWorkflow } from './agentic-loop';

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
>(
  agenticLoopWorkflow: ReturnType<typeof createAgenticLoopWorkflow>,
  {
    resumeContext,
    requireToolApproval,
    telemetry_settings,
    models,
    toolChoice,
    modelSettings,
    _internal,
    modelStreamSpan,
    llmAISpan,
    messageId,
    runId,
    messageList,
    startTimestamp,
    streamState,
    agentId,
    toolCallId,
    ...rest
  }: LoopRun<Tools, OUTPUT>,
) {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const writer = new WritableStream<ChunkType<OUTPUT>>({
        write: chunk => {
          controller.enqueue(chunk);
        },
      });

      modelStreamSpan.setAttributes({
        ...(telemetry_settings?.recordInputs !== false
          ? {
              'stream.prompt.toolChoice': toolChoice ? JSON.stringify(toolChoice) : 'auto',
            }
          : {}),
      });

      // Use the pre-created workflow instance passed as parameter
      const workflowInputData = {
        models,
        telemetry_settings,
        messageId: messageId!,
        runId,
        messageList,
        startTimestamp,
        streamState,
        tools: rest.tools,
        toolChoice,
        modelSettings,
        providerOptions: rest.providerOptions,
        options: rest.options,
        toolCallStreaming: rest.toolCallStreaming,
        structuredOutput: rest.structuredOutput,
        outputProcessors: rest.outputProcessors,
        headers: rest.headers,
        downloadRetries: rest.downloadRetries,
        downloadConcurrency: rest.downloadConcurrency,
        processorStates: rest.processorStates,
        stopWhen: rest.stopWhen,
        maxSteps: rest.maxSteps,
        returnScorerData: rest.returnScorerData,
        modelSpanTracker: rest.modelSpanTracker,
        experimental_generateMessageId: rest.experimental_generateMessageId,
        includeRawChunks: rest.includeRawChunks,
        // Dynamic params that change per execution
        _internal,
        modelStreamSpan,
        controller,
        writer,
        agentId,
      };

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

      const msToFirstChunk = _internal?.now?.()! - startTimestamp!;

      modelStreamSpan.addEvent('ai.stream.firstChunk', {
        'ai.response.msToFirstChunk': msToFirstChunk,
      });

      modelStreamSpan.setAttributes({
        'stream.response.timestamp': new Date(startTimestamp).toISOString(),
        'stream.response.msToFirstChunk': msToFirstChunk,
      });

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

      const run = await agenticLoopWorkflow.createRunAsync({
        runId,
      });

      const runtimeContext = new RuntimeContext();

      if (requireToolApproval) {
        runtimeContext.set('__mastra_requireToolApproval', true);
      }

      // Store workflow data in initialState so all nested workflows can access it
      const initialState = workflowInputData;

      // Execution-specific objects that need to be fresh on each execution (including resume)
      const freshExecutionObjects = {
        controller,
        writer,
        modelStreamSpan,
        _internal,
        messageList, // messageList needs to be fresh on resume as well
        streamState, // streamState with fresh serialize/deserialize functions
        tools: rest.tools, // tools contain functions that can't be serialized
        telemetry_settings, // telemetry_settings contains tracer functions that can't be serialized
        modelSpanTracker: rest.modelSpanTracker, // modelSpanTracker contains functions that can't be serialized
        models, // models contain provider functions that can't be serialized
      };

      console.log('[DEBUG] Created freshExecutionObjects:', {
        hasController: !!controller,
        hasWriter: !!writer,
        hasModelStreamSpan: !!modelStreamSpan,
        hasMessageList: !!messageList,
        hasStreamState: !!streamState,
        hasTools: !!rest.tools,
        toolsCount: rest.tools ? Object.keys(rest.tools).length : 0,
        hasTelemetrySettings: !!telemetry_settings,
        hasModelSpanTracker: !!rest.modelSpanTracker,
        hasModels: !!models,
        modelCount: models ? models.length : 0,
        streamStateFns: streamState ? Object.keys(streamState) : [],
      });

      const executionResult = resumeContext
        ? await (async () => {
            console.log('[DEBUG] Resuming workflow with freshExecutionObjects:', {
              hasResumeData: !!resumeContext.resumeData,
              resumeData: resumeContext.resumeData,
              label: toolCallId,
              hasStateOverride: !!freshExecutionObjects,
            });
            return run.resume({
              resumeData: resumeContext.resumeData,
              tracingContext: { currentSpan: llmAISpan },
              label: toolCallId,
              runtimeContext,
              stateOverride: freshExecutionObjects, // Override stale execution-specific objects from snapshot
            });
          })()
        : await run.start({
            inputData: initialData,
            initialState,
            tracingContext: { currentSpan: llmAISpan },
            runtimeContext,
          });

      console.log('[DEBUG] stream.ts: Workflow execution completed:', {
        status: executionResult.status,
        reason: executionResult.result?.stepResult?.reason,
        isContinued: executionResult.result?.stepResult?.isContinued,
        hasResult: !!executionResult.result,
        isResume: !!resumeContext,
        error: executionResult.status === 'failed' ? executionResult.error : undefined,
      });

      if (executionResult.status !== 'success') {
        console.log('[DEBUG] stream.ts: Closing controller - execution not successful');
        if (executionResult.status === 'failed') {
          console.error('[DEBUG] stream.ts: Workflow failed with error:', executionResult.error);
        }
        controller.close();
        return;
      }

      if (executionResult.result.stepResult?.reason === 'abort') {
        console.log('[DEBUG] stream.ts: Closing controller - abort reason');
        controller.close();
        return;
      }

      console.log('[DEBUG] stream.ts: Enqueueing finish chunk');
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

      const msToFinish = (_internal?.now?.() ?? Date.now()) - startTimestamp;
      modelStreamSpan.addEvent('ai.stream.finish');
      modelStreamSpan.setAttributes({
        'stream.response.msToFinish': msToFinish,
        'stream.response.avgOutputTokensPerSecond':
          (1000 * (executionResult?.result?.output?.usage?.outputTokens ?? 0)) / msToFinish,
      });

      controller.close();
    },
  });
}
