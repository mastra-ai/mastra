import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage, MessageInput } from '@mastra/core/agent/message-list';
import { isProcessorWorkflow, ProcessorRunner, validateProcessorResultExclusivity } from '@mastra/core/processors';
import type { Processor, ProcessorWorkflow } from '@mastra/core/processors';

import { HTTPException } from '../http-exception';
import {
  listProcessorsResponseSchema,
  serializedProcessorDetailSchema,
  processorIdPathParams,
  executeProcessorBodySchema,
  executeProcessorResponseSchema,
} from '../schemas/processors';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// Route Definitions
// ============================================================================

type ProcessorPhase = 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';

/**
 * Helper to extract text from messages for outputStep testing.
 * In real usage, the `text` field contains the assistant's response text.
 */
function extractTextFromMessages(messages: unknown[]): string {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return '';
  }
  const firstMessage = messages[0] as any;
  if (firstMessage?.content?.parts) {
    const textParts = firstMessage.content.parts
      .filter((part: any) => part?.type === 'text')
      .map((part: any) => part?.text || '');
    return textParts.join('');
  }
  return '';
}

/**
 * Helper to detect phases for a processor.
 * For individual processors, checks which methods are implemented.
 * For workflow processors, returns all phases since createStep handles each phase
 * and it's a no-op if the underlying processor doesn't implement it.
 */
function detectProcessorPhases(processor: any): ProcessorPhase[] {
  // Check if it's a workflow processor
  if (isProcessorWorkflow(processor)) {
    // Workflow processors can potentially handle all phases
    // The createStep in workflows handles each phase and it's a no-op if not implemented
    return ['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep'];
  }

  // For individual processors, detect by checking which methods exist
  const phases: ProcessorPhase[] = [];
  if (typeof processor.processInput === 'function') {
    phases.push('input');
  }
  if (typeof processor.processInputStep === 'function') {
    phases.push('inputStep');
  }
  if (typeof processor.processOutputStream === 'function') {
    phases.push('outputStream');
  }
  if (typeof processor.processOutputResult === 'function') {
    phases.push('outputResult');
  }
  if (typeof processor.processOutputStep === 'function') {
    phases.push('outputStep');
  }
  return phases;
}

export const LIST_PROCESSORS_ROUTE = createRoute({
  method: 'GET',
  path: '/processors',
  responseType: 'json',
  responseSchema: listProcessorsResponseSchema,
  summary: 'List all processors',
  description: 'Returns a list of all available individual processors',
  tags: ['Processors'],
  requiresAuth: true,
  handler: async ({ mastra }) => {
    try {
      const processors = mastra.listProcessors() || {};
      const processorConfigurations = mastra.listProcessorConfigurations();
      const result: Record<
        string,
        {
          id: string;
          name?: string;
          description?: string;
          phases: ProcessorPhase[];
          agentIds: string[];
          configurations: Array<{ agentId: string; type: 'input' | 'output' }>;
          isWorkflow: boolean;
        }
      > = {};

      // Iterate through all individual processors registered with Mastra
      for (const [processorKey, processorEntry] of Object.entries(processors)) {
        const processor = processorEntry as Processor | ProcessorWorkflow;
        const processorId = processor.id || processorKey;

        // Check if it's a workflow processor
        const isWorkflow = isProcessorWorkflow(processor);

        // Detect phases (handles both individual processors and workflow processors)
        const phases = detectProcessorPhases(processor);

        // Get agent configurations for this processor
        const configs = processorConfigurations.get(processorId) || [];
        const agentIds = [...new Set(configs.map(c => c.agentId))];
        const configurations = configs.map(c => ({ agentId: c.agentId, type: c.type }));

        result[processorId] = {
          id: processorId,
          name: processor.name || processorId,
          description: processor.description,
          phases,
          agentIds,
          configurations,
          isWorkflow,
        };
      }

      return result;
    } catch (error) {
      return handleError(error, 'Error getting processors');
    }
  },
});

export const GET_PROCESSOR_BY_ID_ROUTE = createRoute({
  method: 'GET',
  path: '/processors/:processorId',
  responseType: 'json',
  pathParamSchema: processorIdPathParams,
  responseSchema: serializedProcessorDetailSchema,
  summary: 'Get processor by ID',
  description: 'Returns details for a specific processor including its phases and configurations',
  tags: ['Processors'],
  requiresAuth: true,
  handler: async ({ mastra, processorId }) => {
    try {
      // Get the processor from Mastra's registered processors
      let processorEntry: Processor | ProcessorWorkflow | undefined;
      try {
        processorEntry = mastra.getProcessorById(processorId) as Processor | ProcessorWorkflow;
      } catch {
        // getProcessorById throws if not found, try by key
        const processors = mastra.listProcessors() || {};
        processorEntry = processors[processorId as keyof typeof processors] as Processor | ProcessorWorkflow;
      }

      if (!processorEntry) {
        throw new HTTPException(404, { message: 'Processor not found' });
      }

      // Check if it's a workflow processor
      const isWorkflow = isProcessorWorkflow(processorEntry);

      // Detect phases (handles both individual processors and workflow processors)
      const phases = detectProcessorPhases(processorEntry);

      // Get agent configurations for this processor
      const configs = mastra.getProcessorConfigurations(processorId);
      const agents = mastra.listAgents() || {};
      const configurations = configs.map(c => ({
        agentId: c.agentId,
        agentName: agents[c.agentId]?.name || c.agentId,
        type: c.type,
      }));

      return {
        id: processorEntry.id,
        name: processorEntry.name || processorEntry.id,
        description: processorEntry.description,
        phases,
        configurations,
        isWorkflow,
      };
    } catch (error) {
      return handleError(error, 'Error getting processor');
    }
  },
});

export const EXECUTE_PROCESSOR_ROUTE = createRoute({
  method: 'POST',
  path: '/processors/:processorId/execute',
  responseType: 'json',
  pathParamSchema: processorIdPathParams,
  bodySchema: executeProcessorBodySchema,
  responseSchema: executeProcessorResponseSchema,
  summary: 'Execute processor',
  description: 'Executes a specific processor with the provided input data',
  tags: ['Processors'],
  requiresAuth: true,
  handler: async ({ mastra, processorId, ...bodyParams }) => {
    try {
      const { phase, messages, modelContextMessages } = bodyParams;
      const rawInputMessages = modelContextMessages ?? messages;

      if (!processorId) {
        throw new HTTPException(400, { message: 'Processor ID is required' });
      }

      if (!phase) {
        throw new HTTPException(400, { message: 'Phase is required' });
      }

      if (!Array.isArray(rawInputMessages)) {
        throw new HTTPException(400, { message: 'Messages or modelContextMessages array is required' });
      }

      const inputMessages = rawInputMessages as unknown as MastraDBMessage[];

      // Get the processor from Mastra's registered processors
      let processor;
      try {
        processor = mastra.getProcessorById(processorId);
      } catch {
        // getProcessorById throws if not found, try by key
        const processors = mastra.listProcessors() || {};
        processor = processors[processorId as keyof typeof processors];
      }

      if (!processor) {
        throw new HTTPException(404, { message: 'Processor not found' });
      }

      const messageList = new MessageList();
      messageList.add(inputMessages as unknown as MessageInput[], 'input');

      // Check if this is a workflow processor
      if (isProcessorWorkflow(processor)) {
        // Execute workflow processor
        try {
          // Build inputData based on phase - each phase has different required fields
          const baseInputData = {
            phase: phase as 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep',
            messages: inputMessages,
            messageList,
            ...(modelContextMessages !== undefined ? { modelContextMessages } : {}),
            retryCount: 0,
          };
          let inputData: Record<string, unknown> = baseInputData;

          // Add phase-specific fields
          switch (phase) {
            case 'input':
              inputData = {
                ...inputData,
                systemMessages: [],
              };
              break;
            case 'inputStep':
              inputData = {
                ...inputData,
                stepNumber: 0,
                systemMessages: [],
                steps: [],
                model: '',
                tools: {},
                toolChoice: undefined,
                activeTools: [],
                providerOptions: undefined,
                modelSettings: undefined,
                structuredOutput: undefined,
              };
              break;
            case 'outputResult':
              inputData = {
                ...inputData,
                state: {},
                result: {
                  text: extractTextFromMessages(inputMessages),
                  usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                  finishReason: 'unknown',
                  steps: [],
                },
              };
              break;
            case 'outputStep':
              inputData = {
                ...inputData,
                stepNumber: 0,
                systemMessages: [],
                steps: [],
                finishReason: 'stop',
                toolCalls: [],
                text: extractTextFromMessages(inputMessages),
              };
              break;
            case 'outputStream':
              inputData = {
                ...inputData,
                part: null,
                streamParts: [],
                state: {},
              };
              break;
          }

          const run = await processor.createRun();
          const result = await run.start({
            inputData: inputData as any,
          });

          // Check for tripwire status
          if (result.status === 'tripwire') {
            return {
              success: false,
              phase,
              tripwire: {
                triggered: true,
                reason: result.tripwire.reason || `Tripwire triggered in workflow ${processor.id}`,
                metadata: result.tripwire.metadata,
              },
              messages: inputMessages,
              messageList: {
                messages: inputMessages,
              },
            };
          }

          // Check for execution failure
          if (result.status !== 'success') {
            throw new HTTPException(500, {
              message: `Processor workflow ${processor.id} failed with status: ${result.status}`,
            });
          }

          // Extract output from workflow result
          const output = result.result;
          let outputMessages: MastraDBMessage[] = inputMessages;
          let outputModelContextMessages: MastraDBMessage[] | undefined;

          if (output && typeof output === 'object') {
            validateProcessorResultExclusivity({ result: output, processorId: processor.id });
            if ('modelContextMessages' in output && Array.isArray(output.modelContextMessages)) {
              outputModelContextMessages = output.modelContextMessages as MastraDBMessage[];
            } else if ('messages' in output && Array.isArray(output.messages)) {
              outputMessages = output.messages as MastraDBMessage[];
            } else if ('messageList' in output && output.messageList instanceof MessageList) {
              outputMessages = output.messageList.get.all.db();
            }
          }

          return {
            success: true,
            phase,
            ...(outputModelContextMessages !== undefined
              ? { modelContextMessages: outputModelContextMessages }
              : { messages: outputMessages }),
            messageList: {
              messages: outputMessages,
            },
          };
        } catch (error: any) {
          // Re-throw HTTP exceptions
          if (error instanceof HTTPException) {
            throw error;
          }
          throw new HTTPException(500, {
            message: `Error executing processor workflow: ${error.message}`,
          });
        }
      }

      // Handle individual processor execution
      // Create the abort function for tripwire support
      let tripwireTriggered = false;
      let tripwireReason: string | undefined;
      let tripwireMetadata: unknown;

      const abort = (reason?: string, options?: { retry?: boolean; metadata?: unknown }) => {
        tripwireTriggered = true;
        tripwireReason = reason;
        tripwireMetadata = options?.metadata;
        throw new Error(`TRIPWIRE:${reason || 'Processor aborted'}`);
      };

      // Build the context based on phase
      const baseContext = {
        abort,
        retryCount: 0,
        messages: inputMessages,
        messageList,
        state: {},
      };

      try {
        let result: any;

        // Execute the specific phase method on the individual processor
        switch (phase) {
          case 'input':
            if (!processor.processInput) {
              throw new HTTPException(400, { message: 'Processor does not support input phase' });
            }
            result = await processor.processInput({
              ...baseContext,
              systemMessages: [],
            });
            break;

          case 'inputStep':
            if (!processor.processInputStep) {
              throw new HTTPException(400, { message: 'Processor does not support inputStep phase' });
            }
            result = await processor.processInputStep({
              ...baseContext,
              systemMessages: [],
              stepNumber: 0,
              steps: [],
              // Pass empty/default values for all inputStep fields
              model: '' as any,
              tools: {},
              toolChoice: undefined,
              activeTools: [],
              providerOptions: undefined,
              modelSettings: undefined,
              structuredOutput: undefined,
            });
            break;

          case 'outputResult':
            if (!processor.processOutputResult) {
              throw new HTTPException(400, { message: 'Processor does not support outputResult phase' });
            }
            result = await processor.processOutputResult({
              ...baseContext,
              state: {},
              result: {
                text: extractTextFromMessages(inputMessages),
                usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
                finishReason: 'unknown',
                steps: [],
              },
            });
            break;

          case 'outputStep':
            if (!processor.processOutputStep) {
              throw new HTTPException(400, { message: 'Processor does not support outputStep phase' });
            }
            result = await processor.processOutputStep({
              ...baseContext,
              systemMessages: [],
              stepNumber: 0,
              steps: [],
              finishReason: 'stop',
              toolCalls: [],
              text: extractTextFromMessages(inputMessages),
              usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
            });
            break;

          case 'outputStream':
            // outputStream is for streaming chunks, not a simple execute
            throw new HTTPException(400, {
              message: 'outputStream phase cannot be executed directly. Use streaming instead.',
            });

          default:
            throw new HTTPException(400, { message: `Unknown phase: ${phase}` });
        }

        // Process the result
        let outputMessages: MastraDBMessage[] = inputMessages;
        let outputModelContextMessages: MastraDBMessage[] | undefined;
        if (result) {
          if (phase === 'input') {
            const validatedResult = ProcessorRunner.validateAndFormatProcessInputResult(result, {
              messageList,
              processor,
            });
            if ('modelContextMessages' in validatedResult) {
              outputModelContextMessages = validatedResult.modelContextMessages as MastraDBMessage[] | undefined;
            } else if (validatedResult.messages) {
              outputMessages = validatedResult.messages;
            } else if (validatedResult.messageList) {
              outputMessages = validatedResult.messageList.get.all.db();
            }
          } else if (phase === 'inputStep') {
            const validatedResult = await ProcessorRunner.validateAndFormatProcessInputStepResult(result, {
              messageList,
              processor,
              stepNumber: 0,
            });
            if ('modelContextMessages' in validatedResult) {
              outputModelContextMessages = validatedResult.modelContextMessages;
            } else if (validatedResult.messages) {
              outputMessages = validatedResult.messages;
            } else if (validatedResult.messageList) {
              outputMessages = validatedResult.messageList.get.all.db();
            }
          } else {
            if (typeof result === 'object' && !Array.isArray(result) && !(result instanceof MessageList)) {
              validateProcessorResultExclusivity({ result, processorId: processor.id });
            }
            if (Array.isArray(result)) {
              outputMessages = result as MastraDBMessage[];
            } else if (result instanceof MessageList) {
              outputMessages = result.get.all.db();
            } else if (result.messages) {
              outputMessages = result.messages as MastraDBMessage[];
            } else if ('modelContextMessages' in result) {
              outputModelContextMessages = result.modelContextMessages as MastraDBMessage[];
            }
          }
        }

        return {
          success: true,
          phase,
          ...(outputModelContextMessages !== undefined
            ? { modelContextMessages: outputModelContextMessages }
            : { messages: outputMessages }),
          messageList: {
            messages: outputMessages,
          },
        };
      } catch (error: any) {
        // Check if it's a tripwire
        if (tripwireTriggered || error.message?.startsWith('TRIPWIRE:')) {
          return {
            success: false,
            phase,
            tripwire: {
              triggered: true,
              reason: tripwireReason || error.message?.replace('TRIPWIRE:', ''),
              metadata: tripwireMetadata,
            },
            messages: inputMessages,
            messageList: {
              messages: inputMessages,
            },
          };
        }
        throw error;
      }
    } catch (error) {
      return handleError(error, 'Error executing processor');
    }
  },
});
