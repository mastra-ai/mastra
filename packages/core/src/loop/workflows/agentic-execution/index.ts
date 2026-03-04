import type { ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { createWorkflow } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createIsTaskCompleteStep } from './is-task-complete-step';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createToolCallStep } from './tool-call-step';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
  // Track how many response model messages existed before each LLM call.
  // This lets add-response-to-messagelist only add truly NEW messages from the current
  // iteration, preventing historical is-task-complete and iteration-feedback messages
  // from being re-added (which would bypass the isTaskCompleteResult merge guard because
  // the metadata is lost in the MastraDBMessage → ModelMessage round-trip).
  let existingResponseModelCount = 0;

  const llmExecutionStep = createLLMExecutionStep({
    models,
    _internal,
    ...rest,
  });

  const toolCallStep = createToolCallStep({
    models,
    _internal,
    ...rest,
  });

  const llmMappingStep = createLLMMappingStep(
    {
      models,
      _internal,
      ...rest,
    },
    llmExecutionStep,
  );

  const isTaskCompleteStep = createIsTaskCompleteStep({
    models,
    _internal,
    ...rest,
  });

  // Sequential execution may be required for tool calls to avoid race conditions, otherwise concurrency is configurable
  let toolCallConcurrency = 10;
  if (rest?.toolCallConcurrency) {
    toolCallConcurrency = rest.toolCallConcurrency > 0 ? rest.toolCallConcurrency : 10;
  }

  // Check for sequential execution requirements:
  // 1. Global requireToolApproval flag
  // 2. Any tool has suspendSchema
  // 3. Any tool has requireApproval flag
  const hasRequireToolApproval = !!rest.requireToolApproval;

  let hasSuspendSchema = false;
  let hasRequireApproval = false;

  if (rest.tools) {
    for (const tool of Object.values(rest.tools)) {
      if ((tool as any)?.hasSuspendSchema) {
        hasSuspendSchema = true;
      }

      if ((tool as any)?.requireApproval) {
        hasRequireApproval = true;
      }

      if (hasSuspendSchema || hasRequireApproval) break;
    }
  }

  const sequentialExecutionRequired = hasRequireToolApproval || hasSuspendSchema || hasRequireApproval;

  return createWorkflow({
    id: 'executionWorkflow',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
  })
    .map(
      async ({ inputData }) => {
        // Capture response model message count BEFORE the LLM runs.
        // This snapshot is used below to add only NEW messages to the messageList,
        // preventing historical messages (e.g. is-task-complete, iteration-feedback)
        // from being re-added on subsequent iterations.
        existingResponseModelCount = rest.messageList.get.response.aiV5.model().length;
        return inputData as LLMIterationData<Tools, OUTPUT>;
      },
      { id: 'capture-response-count' },
    )
    .then(llmExecutionStep)
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        // Add assistant response messages to messageList BEFORE processing tool calls
        // This ensures messages are available for persistence before suspension.
        // IMPORTANT: only add messages beyond existingResponseModelCount to avoid
        // re-adding historical is-task-complete / iteration-feedback messages whose
        // isTaskCompleteResult metadata is stripped during the ModelMessage round-trip.
        const responseMessages = typedInputData.messages.nonUser;
        const newMessages = responseMessages ? responseMessages.slice(existingResponseModelCount) : [];
        if (newMessages.length > 0) {
          rest.messageList.add(newMessages, 'response');
        }
        return typedInputData;
      },
      { id: 'add-response-to-messagelist' },
    )
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        return typedInputData.output.toolCalls || [];
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, { concurrency: sequentialExecutionRequired ? 1 : toolCallConcurrency })
    .then(llmMappingStep)
    .then(isTaskCompleteStep)
    .commit();
}
