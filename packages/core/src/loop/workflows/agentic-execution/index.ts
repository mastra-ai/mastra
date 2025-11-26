import type { ToolSet } from 'ai-v5';
import { InternalSpans } from '../../../observability';
import type { OutputSchema } from '../../../stream/base/schema';
import { createWorkflow } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createToolCallStep } from './tool-call-step';

export function createAgenticExecutionWorkflow<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema = undefined,
>({ models, _internal, ...rest }: OuterLLMRun<Tools, OUTPUT>) {
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
        const toolCalls = typedInputData.output.toolCalls || [];
        // Attach dynamic tools (from prepareStep) to each tool call
        const stepTools = (typedInputData as any).stepTools;
        if (stepTools) {
          return toolCalls.map(tc => ({ ...tc, dynamicTools: stepTools }));
        }
        return toolCalls;
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, { concurrency: 10 })
    .then(llmMappingStep)
    .commit();
}
