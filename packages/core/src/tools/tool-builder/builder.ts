import type { Schema } from '@internal/ai-v6';
import type { ProviderDefinedTool, ToolExecutionOptions } from '@internal/external-types';
import {
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  GoogleSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
  applyCompatLayer,
  convertZodSchemaToAISDKSchema,
  jsonSchema,
} from '@mastra/schema-compat';
import { z } from 'zod/v4';
import { backgroundOverrideJsonSchema, backgroundOverrideZodSchema } from '../../background-tasks';
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import type { Mastra } from '../../mastra';
import { SpanType, wrapMastra, EntityType, getOrCreateSpan, createObservabilityContext } from '../../observability';
import type { AnySpan } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import { RequestContext } from '../../request-context';
import { isStandardSchemaWithJSON, toStandardSchema, standardSchemaToJSONSchema } from '../../schema';
import type { StandardSchemaWithJSON } from '../../schema';
import { isVercelTool, isProviderDefinedTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import { safeStringify } from '../../utils';
import { isZodObject } from '../../utils/zod-utils';

import type { SuspendOptions } from '../../workflows';
import { ToolStream } from '../stream';
import type {
  CoreTool,
  McpMetadata,
  MastraToolInvocationOptions,
  ToolAction,
  VercelTool,
  VercelToolV5,
} from '../types';
import { validateToolInput, validateToolOutput, validateToolSuspendData } from '../validation';

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
  logData: Record<string, unknown>;
}

export class CoreToolBuilder extends MastraBase {
  private originalTool: ToolToConvert;
  private options: ToolOptions;
  private logType?: LogType;

  constructor(input: {
    originalTool: ToolToConvert;
    options: ToolOptions;
    logType?: LogType;
    autoResumeSuspendedTools?: boolean;
    backgroundTaskEnabled?: boolean;
  }) {
    super({ name: 'CoreToolBuilder' });
    this.originalTool = input.originalTool;
    this.options = input.options;
    this.logType = input.logType;

    // Only inject the `_background` override schema for tools that are actually
    // eligible for background execution — otherwise every user tool's input
    // schema would be mutated with a v4 Zod field, which breaks v3-authored
    // tools (keyValidator._parse crashes in schema-compat validation).
    const isBackgroundEligible = !!input.backgroundTaskEnabled;
    const isResumableTool =
      input.autoResumeSuspendedTools ||
      (this.originalTool as unknown as ToolAction<any, any>).id?.startsWith('agent-') ||
      (this.originalTool as unknown as ToolAction<any, any>).id?.startsWith('workflow-');

    if (!isVercelTool(this.originalTool) && !isProviderDefinedTool(this.originalTool)) {
      // Client tools cross the wire as JSON, so Zod / StandardSchemaWithJSON
      // wrappers don't survive. Normalize raw JSON Schema objects back into
      // a StandardSchemaWithJSON so downstream conversion works.
      const rawInput = this.originalTool.inputSchema as unknown;
      if (
        rawInput &&
        typeof rawInput === 'object' &&
        !isZodObject(rawInput) &&
        !isStandardSchemaWithJSON(rawInput) &&
        !('jsonSchema' in (rawInput as object))
      ) {
        this.originalTool.inputSchema = toStandardSchema(rawInput as any) as any;
      }

      if (isBackgroundEligible || isResumableTool) {
        let schema = this.originalTool.inputSchema;
        if (typeof schema === 'function') {
          schema = schema();
        }
        if (!schema) {
          schema = z.object({});
        }

        if (isZodObject(schema)) {
          let nextSchema = schema;
          if (isBackgroundEligible) {
            nextSchema = nextSchema.extend({
              _background: backgroundOverrideZodSchema,
            });
          }
          if (isResumableTool) {
            nextSchema = nextSchema.extend({
              suspendedToolRunId: z.string().describe('The runId of the suspended tool').nullable().optional(),
              resumeData: z
                .any()
                .describe('The resumeData object created from the resumeSchema of suspended tool')
                .optional(),
            });
          }
          this.originalTool.inputSchema = nextSchema;
        } else {
          // Non-Zod StandardSchemaWithJSON (e.g. JsonSchemaWrapper from JSONSchema7).
          // Extract JSON Schema, add suspend/resume fields, re-wrap.
          const jsonSchema = standardSchemaToJSONSchema(schema as any, { io: 'input' });
          if (jsonSchema && typeof jsonSchema === 'object' && jsonSchema.type === 'object') {
            if (isBackgroundEligible) {
              jsonSchema.properties = {
                ...jsonSchema.properties,
                _background: backgroundOverrideJsonSchema,
              };
            }
            if (isResumableTool) {
              jsonSchema.properties = {
                ...jsonSchema.properties,
                suspendedToolRunId: {
                  type: ['string', 'null'],
                  description: 'The runId of the suspended tool',
                },
                resumeData: {
                  description: 'The resumeData object created from the resumeSchema of suspended tool',
                },
              };
            }
            this.originalTool.inputSchema = toStandardSchema(jsonSchema) as any;
          }
        }
      }
    }
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
    let schema = this.originalTool.inputSchema;

    if (isStandardSchemaWithJSON(schema)) {
      return schema;
    }

    // If schema is a function, call it to get the actual schema
    if (typeof schema === 'function') {
      schema = schema();
    }

    return schema;
  };

  private getOutputSchema = () => {
    if ('outputSchema' in this.originalTool) {
      let schema = this.originalTool.outputSchema;

      if (isStandardSchemaWithJSON(schema)) {
        return schema;
      }

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }

    return null;
  };

  private getResumeSchema = () => {
    if ('resumeSchema' in this.originalTool) {
      let schema = this.originalTool.resumeSchema;

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }
    return null;
  };

  private getSuspendSchema = () => {
    if ('suspendSchema' in this.originalTool) {
      let schema = this.originalTool.suspendSchema;

      // If schema is a function, call it to get the actual schema
      if (typeof schema === 'function') {
        schema = schema();
      }

      return schema;
    }
    return null;
  };

  // For provider-defined tools, we need to include all required properties
  // AI SDK v5 uses type: 'provider-defined', AI SDK v6 uses type: 'provider'
  private buildProviderTool(tool: ToolToConvert): (CoreTool & { id: `${string}.${string}` }) | undefined {
    if (
      'type' in tool &&
      (tool.type === 'provider-defined' || tool.type === 'provider') &&
      'id' in tool &&
      typeof tool.id === 'string' &&
      tool.id.includes('.')
    ) {
      // Get schema directly from provider-defined tool (v4 uses parameters, v5 uses inputSchema)
      let parameters: unknown =
        'parameters' in tool ? tool.parameters : 'inputSchema' in tool ? (tool as any).inputSchema : undefined;

      // If schema is a function, call it to get the actual schema
      if (typeof parameters === 'function') {
        parameters = parameters();
      }

      // Get output schema directly from provider-defined tool
      let outputSchema: unknown = 'outputSchema' in tool ? (tool as any).outputSchema : undefined;

      // If schema is a function, call it to get the actual schema
      if (typeof outputSchema === 'function') {
        outputSchema = outputSchema();
      }

      // Convert parameters to AI SDK Schema format
      let processedParameters;
      if (parameters !== undefined && parameters !== null) {
        if (typeof parameters === 'object' && 'jsonSchema' in parameters) {
          // Already in AI SDK Schema format
          processedParameters = parameters;
        } else if (isStandardSchemaWithJSON(parameters)) {
          // StandardSchemaWithJSON - extract the JSON schema and wrap it
          // Use input since parameters represent tool input
          const jsonSchema = standardSchemaToJSONSchema(parameters, { io: 'input' });
          processedParameters = { jsonSchema };
        } else {
          // Assume Zod schema - convert to AI SDK Schema
          processedParameters = convertZodSchemaToAISDKSchema(parameters as any);
        }
      } else {
        // No schema provided - create default empty object schema for AI SDK v1 compatibility
        // OpenAI requires at minimum type: "object" even for tools without parameters
        processedParameters = {
          jsonSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
        };
      }

      // Convert output schema to AI SDK Schema format if present
      let processedOutputSchema;
      if (outputSchema !== undefined && outputSchema !== null) {
        if (typeof outputSchema === 'object' && 'jsonSchema' in outputSchema) {
          // Already in AI SDK Schema format
          processedOutputSchema = outputSchema;
        } else if (isStandardSchemaWithJSON(outputSchema)) {
          // StandardSchemaWithJSON - extract the JSON schema and wrap it
          const jsonSchema = standardSchemaToJSONSchema(outputSchema);
          processedOutputSchema = { jsonSchema };
        } else {
          // Assume Zod schema - convert to AI SDK Schema
          processedOutputSchema = convertZodSchemaToAISDKSchema(outputSchema as any);
        }
      }

      return {
        ...(processedOutputSchema ? { outputSchema: processedOutputSchema } : {}),
        type: 'provider-defined' as const,
        id: tool.id as `${string}.${string}`,
        // V5 SDK factories set a hardcoded `name` (e.g. "web_search" for
        // anthropic.web_search_20250305). Preserve it so that when this tool
        // is later used with a V6 provider, the bidirectional toolNameMapping
        // resolves the correct model-facing name instead of the versioned ID.
        ...('name' in tool && typeof tool.name === 'string' ? { name: tool.name } : {}),
        args: ('args' in this.originalTool ? this.originalTool.args : {}) as Record<string, unknown>,
        description: tool.description,
        parameters: processedParameters,
        execute: this.originalTool.execute
          ? this.createExecute(
              this.originalTool,
              { ...this.options, description: this.originalTool.description },
              this.logType,
            )
          : undefined,
        toModelOutput: 'toModelOutput' in this.originalTool ? this.originalTool.toModelOutput : undefined,
        inputExamples: 'inputExamples' in this.originalTool ? this.originalTool.inputExamples : undefined,
      } as unknown as (CoreTool & { id: `${string}.${string}` }) | undefined;
    }

    return undefined;
  }

  private createLogMessageOptions({ agentName, toolName, type }: LogOptions): LogMessageOptions {
    const toolType = type === 'toolset' ? 'toolset' : 'tool';
    return {
      start: `Executing ${toolType}`,
      error: `Failed ${toolType} execution`,
      logData: { agent: agentName, tool: toolName },
    };
  }

  private createExecute(tool: ToolToConvert, options: ToolOptions, logType?: 'tool' | 'toolset' | 'client-tool') {
    // don't add memory, mastra, or tracing context to logging (tracingContext may contain sensitive observability credentials)
    const {
      logger,
      mastra: _mastra,
      memory: _memory,
      requestContext,
      model,
      tracingContext: _tracingContext,
      tracingPolicy: _tracingPolicy,
      ...rest
    } = options;
    const logModelObject = {
      modelId: model?.modelId,
      provider: model?.provider,
      specificationVersion: model?.specificationVersion,
    };

    const { start, logData } = this.createLogMessageOptions({
      agentName: options.agentName,
      toolName: options.name,
      type: logType,
    });

    // Extract MCP metadata once with proper typing to avoid repeated unsafe casts
    const mcpMeta =
      !isVercelTool(tool) && 'mcpMetadata' in tool ? (tool as { mcpMetadata?: McpMetadata }).mcpMetadata : undefined;

    const execFunction = async (args: unknown, execOptions: MastraToolInvocationOptions, toolSpan?: AnySpan) => {
      try {
        let result;
        let suspendData = null;

        if (isVercelTool(tool)) {
          // Handle Vercel tools (AI SDK tools)
          result = await executeWithContext({
            span: toolSpan,
            fn: async () => tool?.execute?.(args, execOptions as ToolExecutionOptions),
          });
        } else {
          // Handle Mastra tools - wrap mastra instance with tracing context for context propagation

          /**
           * MASTRA INSTANCE TYPES IN TOOL EXECUTION:
           *
           * Full Mastra & MastraPrimitives (has getAgent, getWorkflow, etc.):
           * - Auto-generated workflow tools from agent.listWorkflows()
           * - These get this.#mastra directly and can be wrapped
           *
           * MastraPrimitives only (limited interface):
           * - Memory tools (from memory.listTools())
           * - Assigned tools (agent.tools)
           * - Toolset tools (from toolsets)
           * - Client tools (passed as tools in generate/stream options)
           * - These get mastraProxy and have limited functionality
           *
           * TODO: Consider providing full Mastra instance to more tool types for enhanced functionality
           */
          // Wrap mastra with tracing context - wrapMastra will handle whether it's a full instance or primitives
          const wrappedMastra = options.mastra ? wrapMastra(options.mastra, { currentSpan: toolSpan }) : options.mastra;

          const resumeSchema = this.getResumeSchema();
          // Pass raw args as first parameter, context as second
          // Properly structure context based on execution source
          const baseContext = {
            threadId: options.threadId,
            resourceId: options.resourceId,
            mastra: wrappedMastra,
            memory: options.memory,
            runId: options.runId,
            requestContext: execOptions.requestContext ?? options.requestContext ?? new RequestContext(),
            // Workspace for file operations and command execution
            // Execution-time workspace (from prepareStep/processInputStep) takes precedence over build-time workspace
            workspace: execOptions.workspace ?? options.workspace,
            // Browser for web automation (lazily initialized on first use)
            browser: options.browser,
            writer: new ToolStream(
              {
                prefix: 'tool',
                callId: execOptions.toolCallId,
                name: options.name,
                runId: options.runId!,
              },
              options.outputWriter || execOptions.outputWriter,
            ),
            ...createObservabilityContext({ currentSpan: toolSpan }),
            abortSignal: execOptions.abortSignal,
            suspend: (args: any, suspendOptions?: SuspendOptions) => {
              suspendData = args;
              const newSuspendOptions = {
                ...(suspendOptions ?? {}),
                resumeSchema:
                  suspendOptions?.resumeSchema ??
                  (resumeSchema
                    ? JSON.stringify(standardSchemaToJSONSchema(toStandardSchema(resumeSchema), { io: 'input' }))
                    : undefined),
              };
              return execOptions.suspend?.(args, newSuspendOptions);
            },
            resumeData: execOptions.resumeData,
          };

          // Check if this is agent execution
          // Agent execution takes precedence over workflow execution because agents may
          // use workflows internally for their agentic loop
          // Note: AI SDK v4 doesn't pass toolCallId/messages, so we also check for agentName and threadId
          const isAgentExecution =
            (execOptions.toolCallId && execOptions.messages) ||
            (options.agentName && options.threadId && !options.workflowId);

          // Check if this is workflow execution (has workflow properties in options)
          // Only consider it workflow execution if it's NOT agent execution
          const isWorkflowExecution = !isAgentExecution && (options.workflow || options.workflowId);

          let toolContext;
          if (isAgentExecution) {
            // Nest agent-specific properties under 'agent' key
            // Do NOT include workflow context even if workflow properties exist
            // (agents use workflows internally but tools should see agent context)
            const { suspend, resumeData, threadId, resourceId, ...restBaseContext } = baseContext;
            toolContext = {
              ...restBaseContext,
              agent: {
                agentId: options.agentId || '',
                toolCallId: execOptions.toolCallId || '',
                messages: execOptions.messages || [],
                suspend,
                resumeData,
                threadId,
                resourceId,
                outputWriter: execOptions.outputWriter,
              },
            };
          } else if (isWorkflowExecution) {
            // Nest workflow-specific properties under 'workflow' key
            const { suspend, resumeData, ...restBaseContext } = baseContext;
            toolContext = {
              ...restBaseContext,
              workflow: options.workflow || {
                runId: options.runId,
                workflowId: options.workflowId,
                state: options.state,
                setState: options.setState,
                suspend,
                resumeData,
              },
            };
          } else if (execOptions.mcp) {
            // MCP execution context
            toolContext = {
              ...baseContext,
              mcp: execOptions.mcp,
            };
          } else {
            // Direct execution or unknown context
            toolContext = baseContext;
          }

          const resumeData = execOptions.resumeData;

          if (resumeData) {
            const resumeValidation = validateToolInput(resumeSchema, resumeData, options.name);
            if (resumeValidation.error) {
              logger?.warn(resumeValidation.error.message);
              toolSpan?.end({ output: resumeValidation.error, attributes: { success: false } });
              return resumeValidation.error as any;
            }
          }

          result = await executeWithContext({ span: toolSpan, fn: async () => tool?.execute?.(args, toolContext) });
        }

        if (suspendData) {
          const suspendSchema = this.getSuspendSchema();
          const suspendValidation = validateToolSuspendData(suspendSchema, suspendData, options.name);
          if (suspendValidation.error) {
            logger?.warn(suspendValidation.error.message);
            toolSpan?.end({ output: suspendValidation.error, attributes: { success: false } });
            return suspendValidation.error as any;
          }
        }

        // Skip validation if suspend was called without a result
        const shouldSkipValidation = typeof result === 'undefined' && !!suspendData;
        if (shouldSkipValidation) {
          toolSpan?.end({ output: result, attributes: { success: true } });
          return result;
        }

        // Validate output for Vercel/AI SDK tools which don't have built-in validation
        // Mastra tools handle their own validation in Tool.execute() which properly
        // applies Zod transforms (e.g., .transform(), .pipe()) to the output
        if (isVercelTool(tool)) {
          const outputSchema = this.getOutputSchema();
          const outputValidation = validateToolOutput(outputSchema, result, options.name, false);
          if (outputValidation.error) {
            logger?.warn(outputValidation.error.message);
            toolSpan?.end({ output: outputValidation.error, attributes: { success: false } });
            return outputValidation.error;
          }
          result = outputValidation.data;
        }

        // Return result (validated for Vercel tools, already validated for Mastra tools)
        toolSpan?.end({ output: result, attributes: { success: true } });
        return result;
      } catch (error) {
        toolSpan?.error({ error: error as Error, attributes: { success: false } });
        throw error;
      }
    };

    return async (args: unknown, execOptions?: MastraToolInvocationOptions) => {
      let logger = options.logger || this.logger;

      // Create tool span early so validation failures are always observable.
      // Prefer execution-time tracingContext (passed at runtime for VNext methods)
      // Fall back to build-time context for Legacy methods (AI SDK v4 doesn't support passing custom options)
      const tracingContext = execOptions?.tracingContext || options.tracingContext;
      const toolRequestContext = execOptions?.requestContext ?? options.requestContext;
      const toolSpan = getOrCreateSpan({
        type: mcpMeta ? SpanType.MCP_TOOL_CALL : SpanType.TOOL_CALL,
        name: mcpMeta ? `mcp_tool: '${options.name}' on '${mcpMeta.serverName}'` : `tool: '${options.name}'`,
        input: args,
        entityType: EntityType.TOOL,
        entityId: options.name,
        entityName: options.name,
        attributes: mcpMeta
          ? {
              mcpServer: mcpMeta.serverName,
              serverVersion: mcpMeta.serverVersion,
              toolDescription: options.description,
            }
          : {
              toolDescription: options.description,
              toolType: logType || 'tool',
            },
        tracingPolicy: options.tracingPolicy,
        tracingContext: tracingContext,
        requestContext: toolRequestContext,
        mastra: options.mastra && 'observability' in options.mastra ? (options.mastra as Mastra) : undefined,
      });

      try {
        logger.debug(start, { ...logData, ...rest, model: logModelObject, args });

        // Validate input parameters if schema exists
        // Use the processed schema for validation if available, otherwise fall back to original
        const parameters = this.getParameters();
        const { data, error } = validateToolInput(parameters, args, options.name);
        //suspendedToolRunId is only required when resumeData is provided
        const suspendedToolRunIdErrToIgnore =
          error?.message?.includes('suspendedToolRunId: Required') && !(args as Record<string, unknown>)?.resumeData;
        if (error && !suspendedToolRunIdErrToIgnore) {
          logger.warn('Tool input validation failed', { ...logData, validationError: error.message });
          toolSpan?.end({ output: error, attributes: { success: false } });
          return error;
        }
        // Use validated/transformed data
        args = data;

        // there is a small delay in stream output so we add an immediate to ensure the stream is ready
        return await new Promise((resolve, reject) => {
          setImmediate(async () => {
            try {
              const result = await execFunction(args, execOptions!, toolSpan);
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
              errorMessage: String(err),
              argsJson: safeStringify(args),
              model: model?.modelId ?? '',
            },
          },
          err,
        );
        toolSpan?.error({ error: mastraError, attributes: { success: false } });
        logger.trackException(mastraError, { ...logData, ...rest, model: logModelObject, args });
        throw mastraError;
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
      onOutput: 'onOutput' in this.originalTool ? this.originalTool.onOutput : undefined,
    };

    // For provider-defined tools, exclude execute and add name as per v5 spec
    if (builtTool.type === 'provider-defined') {
      const { execute, parameters, ...rest } = base;
      // Prefer the preserved provider name (e.g. "web_search" from V5 SDK
      // factories) over the ID-derived name (e.g. "web_search_20250305").
      const name =
        ('name' in builtTool && typeof builtTool.name === 'string' ? builtTool.name : null) ||
        builtTool.id.split('.')[1] ||
        builtTool.id;
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
      // Respect the model's own capability flag; do not disable it based solely on specificationVersion.
      const supportsStructuredOutputs =
        'supportsStructuredOutputs' in model ? (model.supportsStructuredOutputs ?? false) : false;

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

    const originalSchema = this.getParameters();
    let processedInputSchema: Schema | undefined;

    if (originalSchema) {
      if (isStandardSchemaWithJSON(originalSchema)) {
        // Find the first applicable compatibility layer
        const applicableLayer = schemaCompatLayers.find(layer => layer.shouldApply());

        let schemaToUse: StandardSchemaWithJSON;
        if (applicableLayer) {
          schemaToUse = applicableLayer.processToCompatSchema(originalSchema as any);
        } else {
          schemaToUse = toStandardSchema(originalSchema);
        }

        processedInputSchema = jsonSchema(
          standardSchemaToJSONSchema(schemaToUse, {
            io: 'input',
          }),
          {
            validate: (value: unknown) => {
              const result = schemaToUse['~standard'].validate(value);
              // standard-schema validate may return a Promise
              if (result instanceof Promise) {
                return result.then(r => {
                  if ('issues' in r && r.issues) {
                    return {
                      success: false as const,
                      error: new Error(r.issues.map((i: any) => i.message).join(', ')),
                    };
                  }
                  return { success: true as const, value: (r as { value: unknown }).value };
                });
              }
              // standard-schema returns { value } on success or { issues } on failure,
              // but AI SDK expects { success: boolean, value/error }
              if ('issues' in result && result.issues) {
                return {
                  success: false as const,
                  error: new Error(result.issues.map((i: any) => i.message).join(', ')),
                };
              }
              return { success: true as const, value: (result as { value: unknown }).value };
            },
          },
        );
      } else {
        processedInputSchema = applyCompatLayer({
          schema: originalSchema,
          compatLayers: schemaCompatLayers,
          mode: 'aiSdkSchema',
        });
      }
    }

    const outputSchema = this.getOutputSchema();
    let processedOutputSchema;

    if (outputSchema) {
      if (isStandardSchemaWithJSON(outputSchema)) {
        processedOutputSchema = standardSchemaToJSONSchema(outputSchema, { io: 'output' });
      } else {
        processedOutputSchema = applyCompatLayer({
          schema: outputSchema,
          compatLayers: [],
          mode: 'aiSdkSchema',
        });
      }
    }

    // Map AI SDK's needsApproval to our requireApproval
    // needsApproval can be boolean or a function that takes input and returns boolean
    let requireApproval = false;
    let needsApprovalFn: ((input: any) => boolean | Promise<boolean>) | undefined;

    if (typeof this.options.requireApproval === 'function') {
      requireApproval = true;
      needsApprovalFn = this.options.requireApproval;
    } else if (typeof this.options.requireApproval === 'boolean') {
      requireApproval = this.options.requireApproval;
      needsApprovalFn = undefined;
    }

    if (isVercelTool(this.originalTool) && 'needsApproval' in this.originalTool) {
      const needsApproval = (this.originalTool as any).needsApproval;
      if (typeof needsApproval === 'boolean') {
        requireApproval = needsApproval;
        needsApprovalFn = undefined;
      } else if (typeof needsApproval === 'function') {
        // Store the function to evaluate it per-call
        needsApprovalFn = needsApproval;
        // Set requireApproval to true so the tool-call-step knows to check the function
        requireApproval = true;
      }
    }

    const definition = {
      type: 'function' as const,
      description: this.originalTool.description,
      requireApproval,
      needsApprovalFn,
      hasSuspendSchema: !!this.getSuspendSchema(),
      execute: this.originalTool.execute
        ? this.createExecute(
            this.originalTool,
            { ...this.options, description: this.originalTool.description },
            this.logType,
          )
        : undefined,
    };

    return {
      ...definition,
      id: 'id' in this.originalTool ? this.originalTool.id : undefined,
      parameters: processedInputSchema ?? z.object({}),
      outputSchema: processedOutputSchema,
      strict: 'strict' in this.originalTool ? this.originalTool.strict : undefined,
      providerOptions: 'providerOptions' in this.originalTool ? this.originalTool.providerOptions : undefined,
      mcp: 'mcp' in this.originalTool ? this.originalTool.mcp : undefined,
      toModelOutput: 'toModelOutput' in this.originalTool ? this.originalTool.toModelOutput : undefined,
      inputExamples: 'inputExamples' in this.originalTool ? this.originalTool.inputExamples : undefined,
      onInputStart: 'onInputStart' in this.originalTool ? this.originalTool.onInputStart : undefined,
      onInputDelta: 'onInputDelta' in this.originalTool ? this.originalTool.onInputDelta : undefined,
      onInputAvailable: 'onInputAvailable' in this.originalTool ? this.originalTool.onInputAvailable : undefined,
      onOutput: 'onOutput' in this.originalTool ? this.originalTool.onOutput : undefined,
      // Preserve tool-level background config so the agentic loop can pick it up
      // from the converted CoreTool at dispatch time.
      backgroundConfig: this.options.backgroundConfig,
    } as unknown as CoreTool;
  }
}
