import type { ToolCallOptions } from '@ai-sdk/provider-utils-v5';
import {
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  GoogleSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
  applyCompatLayer,
  convertZodSchemaToAISDKSchema,
} from '@mastra/schema-compat';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';
import { AISpanType } from '../../ai-tracing';
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import { RuntimeContext } from '../../runtime-context';
import { isVercelTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import { ToolStream } from '../stream';
import type { CoreTool, ToolAction, VercelTool, VercelToolV5 } from '../types';
import { validateToolInput } from '../validation';

export type ToolToConvert = VercelTool | ToolAction<any, any, any> | VercelToolV5;
export type LogType = 'tool' | 'toolset' | 'client-tool';

interface LogOptions {
  agentName?: string;
  toolName: string;
  type?: 'tool' | 'toolset' | 'client-tool';
}

interface LogMessageOptions {
  start: string;
  error: string;
}

export class CoreToolBuilder extends MastraBase {
  private originalTool: ToolToConvert;
  private options: ToolOptions;
  private logType?: LogType;

  constructor(input: { originalTool: ToolToConvert; options: ToolOptions; logType?: LogType }) {
    super({ name: 'CoreToolBuilder' });
    this.originalTool = input.originalTool;
    this.options = input.options;
    this.logType = input.logType;
  }

  // Helper to get parameters based on tool type
  private getParameters = () => {
    if (isVercelTool(this.originalTool)) {
      return this.originalTool.parameters ?? z.object({});
    }

    return this.originalTool.inputSchema ?? z.object({});
  };

  private getOutputSchema = () => {
    if ('outputSchema' in this.originalTool) return this.originalTool.outputSchema;
    return null;
  };

  // For provider-defined tools, we need to include all required properties
  private buildProviderTool(tool: ToolToConvert): (CoreTool & { id: `${string}.${string}` }) | undefined {
    if (
      'type' in tool &&
      tool.type === 'provider-defined' &&
      'id' in tool &&
      typeof tool.id === 'string' &&
      tool.id.includes('.')
    ) {
      const parameters = this.getParameters();
      const outputSchema = this.getOutputSchema();
      return {
        type: 'provider-defined' as const,
        id: tool.id,
        args: ('args' in this.originalTool ? this.originalTool.args : {}) as Record<string, unknown>,
        description: tool.description,
        parameters: convertZodSchemaToAISDKSchema(parameters),
        ...(outputSchema ? { outputSchema: convertZodSchemaToAISDKSchema(outputSchema) } : {}),
        execute: this.originalTool.execute
          ? this.createExecute(
              this.originalTool,
              { ...this.options, description: this.originalTool.description },
              this.logType,
            )
          : undefined,
      };
    }

    return undefined;
  }

  private createLogMessageOptions({ agentName, toolName, type }: LogOptions): LogMessageOptions {
    // If no agent name, use default format
    if (!agentName) {
      return {
        start: `Executing tool ${toolName}`,
        error: `Failed tool execution`,
      };
    }

    const prefix = `[Agent:${agentName}]`;
    const toolType = type === 'toolset' ? 'toolset' : 'tool';

    return {
      start: `${prefix} - Executing ${toolType} ${toolName}`,
      error: `${prefix} - Failed ${toolType} execution`,
    };
  }

  private createExecute(tool: ToolToConvert, options: ToolOptions, logType?: 'tool' | 'toolset' | 'client-tool') {
    // dont't add memory or mastra to logging
    const { logger, mastra: _mastra, memory: _memory, runtimeContext, ...rest } = options;

    const { start, error } = this.createLogMessageOptions({
      agentName: options.agentName,
      toolName: options.name,
      type: logType,
    });

    const execFunction = async (args: unknown, execOptions: ToolExecutionOptions | ToolCallOptions) => {
      // Create tool span if we have an current span available
      const toolSpan = options.tracingContext.currentSpan?.createChildSpan({
        type: AISpanType.TOOL_CALL,
        name: `tool: ${options.name}`,
        input: args,
        attributes: {
          toolId: options.name,
          toolDescription: options.description,
          toolType: logType || 'tool',
        },
      });

      try {
        let result;

        if (isVercelTool(tool)) {
          // Handle Vercel tools (AI SDK tools)
          result = await tool?.execute?.(args, execOptions as ToolExecutionOptions);
        } else {
          // Handle Mastra tools
          result = await tool?.execute?.(
            {
              context: args,
              threadId: options.threadId,
              resourceId: options.resourceId,
              mastra: options.mastra,
              memory: options.memory,
              runId: options.runId,
              runtimeContext: options.runtimeContext ?? new RuntimeContext(),
              writer: new ToolStream(
                {
                  prefix: 'tool',
                  callId: execOptions.toolCallId,
                  name: options.name,
                  runId: options.runId!,
                },
                options.writableStream || (execOptions as any).writableStream,
              ),
              tracingContext: { currentSpan: toolSpan },
            },
            execOptions as ToolExecutionOptions & ToolCallOptions,
          );
        }

        toolSpan?.end({ output: result });
        return result ?? undefined;
      } catch (error) {
        toolSpan?.error({ error: error as Error });
        throw error;
      }
    };

    return async (args: unknown, execOptions?: ToolExecutionOptions | ToolCallOptions) => {
      let logger = options.logger || this.logger;
      try {
        logger.debug(start, { ...rest, args });

        // Validate input parameters if schema exists
        const parameters = this.getParameters();
        const { data, error } = validateToolInput(parameters, args, options.name);
        if (error) {
          logger.warn(`Tool input validation failed for '${options.name}'`, {
            toolName: options.name,
            errors: error.validationErrors,
            args,
          });
          return error;
        }
        // Use validated/transformed data
        args = data;

        // there is a small delay in stream output so we add an immediate to ensure the stream is ready
        return await new Promise((resolve, reject) => {
          setImmediate(async () => {
            try {
              const result = await execFunction(args, execOptions!);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      } catch (err) {
        const mastraError = new MastraError(
          {
            id: 'TOOL_EXECUTION_FAILED',
            domain: ErrorDomain.TOOL,
            category: ErrorCategory.USER,
            details: {
              errorMessage: String(error),
              argsJson: JSON.stringify(args),
              model: rest.model?.modelId ?? '',
            },
          },
          err,
        );
        logger.trackException(mastraError);
        logger.error(error, { ...rest, error: mastraError, args });
        return mastraError;
      }
    };
  }

  buildV5() {
    const builtTool = this.build();

    if (!builtTool.parameters) {
      throw new Error('Tool parameters are required');
    }

    return {
      ...builtTool,
      inputSchema: builtTool.parameters,
      onInputStart: 'onInputStart' in this.originalTool ? this.originalTool.onInputStart : undefined,
      onInputDelta: 'onInputDelta' in this.originalTool ? this.originalTool.onInputDelta : undefined,
      onInputAvailable: 'onInputAvailable' in this.originalTool ? this.originalTool.onInputAvailable : undefined,
    } as VercelToolV5;
  }

  build(): CoreTool {
    const providerTool = this.buildProviderTool(this.originalTool);
    if (providerTool) {
      return providerTool;
    }

    const definition = {
      type: 'function' as const,
      description: this.originalTool.description,
      parameters: this.getParameters(),
      outputSchema: this.getOutputSchema(),
      execute: this.originalTool.execute
        ? this.createExecute(
            this.originalTool,
            { ...this.options, description: this.originalTool.description },
            this.logType,
          )
        : undefined,
    };

    const model = this.options.model;

    const schemaCompatLayers = [];

    if (model) {
      const supportsStructuredOutputs =
        model.specificationVersion !== 'v2' ? (model.supportsStructuredOutputs ?? false) : false;

      const modelInfo = {
        modelId: model.modelId,
        supportsStructuredOutputs,
        provider: model.provider,
      };

      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(modelInfo),
        new OpenAISchemaCompatLayer(modelInfo),
        new GoogleSchemaCompatLayer(modelInfo),
        new AnthropicSchemaCompatLayer(modelInfo),
        new DeepSeekSchemaCompatLayer(modelInfo),
        new MetaSchemaCompatLayer(modelInfo),
      );
    }

    const processedSchema = applyCompatLayer({
      schema: this.getParameters(),
      compatLayers: schemaCompatLayers,
      mode: 'aiSdkSchema',
    });

    let processedOutputSchema;

    if (this.getOutputSchema()) {
      processedOutputSchema = applyCompatLayer({
        schema: this.getOutputSchema(),
        compatLayers: schemaCompatLayers,
        mode: 'aiSdkSchema',
      });
    }

    return {
      ...definition,
      id: 'id' in this.originalTool ? this.originalTool.id : undefined,
      parameters: processedSchema,
      outputSchema: processedOutputSchema,
    };
  }
}
