import type { ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { createWorkflow } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createToolCallStep } from './tool-call-step';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
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
    .then(llmExecutionStep)
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        // Add assistant response messages to messageList BEFORE processing tool calls
        // This ensures messages are available for persistence before suspension
        const responseMessages = typedInputData.messages.nonUser;
        if (responseMessages && responseMessages.length > 0) {
          rest.messageList.add(responseMessages, 'response');
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
    .commit();
}
