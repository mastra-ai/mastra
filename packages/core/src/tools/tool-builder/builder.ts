import type { ToolCallOptions, ProviderDefinedTool } from '@internal/external-types';
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
import { AISpanType, wrapMastra } from '../../ai-tracing';
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import { RequestContext } from '../../runtime-context';
import { isVercelTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import { ToolStream } from '../stream';
import type { CoreTool, MastraToolInvocationOptions, ToolAction, VercelTool, VercelToolV5 } from '../types';
import { validateToolInput } from '../validation';

/**
 * Types that can be converted to Mastra tools.
 * Includes provider-defined tools from external packages via ProviderDefinedTool.
 */
export type ToolToConvert = VercelTool | ToolAction<any, any, any> | VercelToolV5 | ProviderDefinedTool;
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
      // Handle both 'parameters' (v4) and 'inputSchema' (v5) properties
      // Also handle case where the schema is a function that returns a schema
      let schema =
        this.originalTool.parameters ??
        ('inputSchema' in this.originalTool ? (this.originalTool as any).inputSchema : undefined) ??
        z.object({});

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }

    // For Mastra tools, inputSchema might also be a function
    let schema = this.originalTool.inputSchema ?? z.object({});

    // If schema is a function, call it to get the actual schema
    if (typeof schema === 'function') {
      schema = schema();
    }

    return schema;
  };

  private getOutputSchema = () => {
    if ('outputSchema' in this.originalTool) {
      let schema = this.originalTool.outputSchema;

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }
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
        id: tool.id as `${string}.${string}`,
        args: ('args' in this.originalTool ? this.originalTool.args : {}) as Record<string, unknown>,
        description: tool.description,
        parameters: parameters.jsonSchema ? parameters : convertZodSchemaToAISDKSchema(parameters),
        ...(outputSchema
          ? { outputSchema: outputSchema.jsonSchema ? outputSchema : convertZodSchemaToAISDKSchema(outputSchema) }
          : {}),
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

  private createExecute(
    tool: ToolToConvert,
    options: ToolOptions,
    logType?: 'tool' | 'toolset' | 'client-tool',
    processedSchema?: z.ZodTypeAny,
  ) {
    // dont't add memory or mastra to logging
    const { logger, mastra: _mastra, memory: _memory, requestContext, model, ...rest } = options;
    const logModelObject = {
      modelId: model?.modelId,
      provider: model?.provider,
      specificationVersion: model?.specificationVersion,
    };

    const { start, error } = this.createLogMessageOptions({
      agentName: options.agentName,
      toolName: options.name,
      type: logType,
    });

    const execFunction = async (args: unknown, execOptions: MastraToolInvocationOptions) => {
      // Prefer execution-time tracingContext (passed at runtime for VNext methods)
      // Fall back to build-time context for Legacy methods (AI SDK v4 doesn't support passing custom options)
      const tracingContext = execOptions.tracingContext || options.tracingContext;

      // Create tool span if we have a current span available
      const toolSpan = tracingContext?.currentSpan?.createChildSpan({
        type: AISpanType.TOOL_CALL,
        name: `tool: '${options.name}'`,
        input: args,
        attributes: {
          toolId: options.name,
          toolDescription: options.description,
          toolType: logType || 'tool',
        },
        tracingPolicy: options.tracingPolicy,
      });

      try {
        let result;

        if (isVercelTool(tool)) {
          // Handle Vercel tools (AI SDK tools)
          result = await tool?.execute?.(args, execOptions as ToolExecutionOptions);
        } else {
          // Handle Mastra tools - wrap mastra instance with tracing context for context propagation

          /**
           * MASTRA INSTANCE TYPES IN TOOL EXECUTION:
           *
           * Full Mastra & MastraPrimitives (has getAgent, getWorkflow, etc.):
           * - Auto-generated workflow tools from agent.getWorkflows()
           * - These get this.#mastra directly and can be wrapped
           *
           * MastraPrimitives only (limited interface):
           * - Memory tools (from memory.getTools())
           * - Assigned tools (agent.tools)
           * - Toolset tools (from toolsets)
           * - Client tools (passed as tools in generate/stream options)
           * - These get mastraProxy and have limited functionality
           *
           * TODO: Consider providing full Mastra instance to more tool types for enhanced functionality
           */
          // Wrap mastra with tracing context - wrapMastra will handle whether it's a full instance or primitives
          const wrappedMastra = options.mastra ? wrapMastra(options.mastra, { currentSpan: toolSpan }) : options.mastra;

          result = await tool?.execute?.(
            {
              context: args,
              threadId: options.threadId,
              resourceId: options.resourceId,
              mastra: wrappedMastra,
              memory: options.memory,
              runId: options.runId,
              requestContext: options.requestContext ?? new RequestContext(),
              writer: new ToolStream(
                {
                  prefix: 'tool',
                  callId: execOptions.toolCallId,
                  name: options.name,
                  runId: options.runId!,
                },
                options.writableStream || execOptions.writableStream,
              ),
              tracingContext: { currentSpan: toolSpan },
              // Pass MCP context if available (when executed in MCP server context)
              mcp: execOptions.mcp,
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

    return async (args: unknown, execOptions?: MastraToolInvocationOptions) => {
      let logger = options.logger || this.logger;
      try {
        logger.debug(start, { ...rest, model: logModelObject, args });

        // Validate input parameters if schema exists
        // Use the processed schema for validation if available, otherwise fall back to original
        const parameters = processedSchema || this.getParameters();
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
              model: model?.modelId ?? '',
            },
          },
          err,
        );
        logger.trackException(mastraError);
        logger.error(error, { ...rest, model: logModelObject, error: mastraError, args });
        return mastraError;
      }
    };
  }

  buildV5() {
    const builtTool = this.build();

    if (!builtTool.parameters) {
      throw new Error('Tool parameters are required');
    }

    const base = {
      ...builtTool,
      inputSchema: builtTool.parameters,
      onInputStart: 'onInputStart' in this.originalTool ? this.originalTool.onInputStart : undefined,
      onInputDelta: 'onInputDelta' in this.originalTool ? this.originalTool.onInputDelta : undefined,
      onInputAvailable: 'onInputAvailable' in this.originalTool ? this.originalTool.onInputAvailable : undefined,
    };

    // For provider-defined tools, exclude execute and add name as per v5 spec
    if (builtTool.type === 'provider-defined') {
      const { execute, parameters, ...rest } = base;
      const name = builtTool.id.split('.')[1] || builtTool.id;
      return {
        ...rest,
        type: builtTool.type,
        id: builtTool.id,
        name,
        args: builtTool.args,
      } as VercelToolV5;
    }

    return base as VercelToolV5;
  }

  build(): CoreTool {
    const providerTool = this.buildProviderTool(this.originalTool);
    if (providerTool) {
      return providerTool;
    }

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

    // Apply schema compatibility to get both the transformed Zod schema (for validation)
    // and the AI SDK Schema (for the LLM)
    let processedZodSchema: z.ZodTypeAny | undefined;
    let processedSchema;

    const originalSchema = this.getParameters();

    // Find the first applicable compatibility layer
    const applicableLayer = schemaCompatLayers.find(layer => layer.shouldApply());

    if (applicableLayer && originalSchema) {
      // Get the transformed Zod schema (with constraints removed/modified)
      processedZodSchema = applicableLayer.processZodType(originalSchema);
      // Convert to AI SDK Schema for the LLM
      processedSchema = applyCompatLayer({
        schema: originalSchema,
        compatLayers: schemaCompatLayers,
        mode: 'aiSdkSchema',
      });
    } else {
      // No compatibility layer applies, use original schema
      processedZodSchema = originalSchema;
      processedSchema = applyCompatLayer({
        schema: originalSchema,
        compatLayers: schemaCompatLayers,
        mode: 'aiSdkSchema',
      });
    }

    let processedOutputSchema;

    if (this.getOutputSchema()) {
      processedOutputSchema = applyCompatLayer({
        schema: this.getOutputSchema(),
        compatLayers: schemaCompatLayers,
        mode: 'aiSdkSchema',
      });
    }

    const definition = {
      type: 'function' as const,
      description: this.originalTool.description,
      parameters: this.getParameters(),
      outputSchema: this.getOutputSchema(),
      requireApproval: this.options.requireApproval,
      execute: this.originalTool.execute
        ? this.createExecute(
            this.originalTool,
            { ...this.options, description: this.originalTool.description },
            this.logType,
            processedZodSchema, // Pass the processed Zod schema for validation
          )
        : undefined,
    };

    return {
      ...definition,
      id: 'id' in this.originalTool ? this.originalTool.id : undefined,
      parameters: processedSchema,
      outputSchema: processedOutputSchema,
    } as unknown as CoreTool;
  }
}
