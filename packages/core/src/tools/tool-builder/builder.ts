import {
  OpenAIReasoningSchemaCompatLayer,
  OpenAISchemaCompatLayer,
  GoogleSchemaCompatLayer,
  AnthropicSchemaCompatLayer,
  DeepSeekSchemaCompatLayer,
  MetaSchemaCompatLayer,
  convertZodSchemaToAISDKSchema,
  applyCompatLayer,
} from '@mastra/schema-compat';
import type { ToolCallOptions, Tool } from 'ai';
import { z } from 'zod';
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import { RuntimeContext } from '../../runtime-context';
import { isVercelTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import { isVercelV5Tool, isCoreToolWithVercelV5 } from '../ai-sdk-v5-compat';
import type { CoreTool, ToolAction } from '../types';

export type ToolToConvert =
  | ToolAction<any, any, any> // Mastra ToolAction
  | Tool<any, any> // Vercel AI SDK v5 Tool
  | CoreTool<any>; // Our unified CoreTool
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
    const tool = this.originalTool as any;

    // Check if this is a CoreTool with Vercel v5 wrapper
    if (isCoreToolWithVercelV5(this.originalTool)) {
      return tool.tool.inputSchema || z.object({});
    }

    // Check if this is a direct Vercel v5 tool
    if (isVercelV5Tool(this.originalTool)) {
      return tool.inputSchema || z.object({});
    }

    // Default to inputSchema or empty object (Mastra tools)
    return tool.inputSchema ?? z.object({});
  };

  private getOutputSchema = () => {
    if ('outputSchema' in this.originalTool) return this.originalTool.outputSchema;
    return null;
  };

  // For provider-defined tools, we need to include all required properties
  private buildProviderTool<T>(tool: ToolToConvert): (CoreTool<T> & { id: `${string}.${string}` }) | undefined {
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
        inputSchema: convertZodSchemaToAISDKSchema(parameters) as T,
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

    const execFunction = async (args: any, execOptions: ToolCallOptions) => {
      const toolAny = tool as any;

      // Check if it's a CoreTool with Vercel v5 wrapper
      if (isCoreToolWithVercelV5(tool)) {
        return toolAny.tool?.execute?.(args, execOptions) ?? undefined;
      }

      // Check if it's a direct Vercel v5 tool
      if (isVercelV5Tool(tool)) {
        return toolAny?.execute?.(args, execOptions) ?? undefined;
      }

      // Check legacy Vercel tool
      if (isVercelTool(tool)) {
        return toolAny?.execute?.(args, execOptions) ?? undefined;
      }

      // Handle Mastra tool (ToolAction or CoreTool)
      return (
        toolAny?.execute?.(
          {
            context: args,
            threadId: options.threadId,
            resourceId: options.resourceId,
            mastra: options.mastra,
            memory: options.memory,
            runId: options.runId,
            runtimeContext: options.runtimeContext ?? new RuntimeContext(),
          },
          execOptions,
        ) ?? undefined
      );
    };

    return async (args: any, execOptions?: any) => {
      let logger = options.logger || this.logger;
      try {
        logger.debug(start, { ...rest, args });
        return await execFunction(args, execOptions);
      } catch (err) {
        const mastraError = new MastraError(
          {
            id: 'TOOL_EXECUTION_FAILED',
            domain: ErrorDomain.TOOL,
            category: ErrorCategory.USER,
            details: {
              error,
              args,
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

  build<T>(): CoreTool<T> {
    const providerTool = this.buildProviderTool<T>(this.originalTool);
    if (providerTool) {
      return providerTool;
    }

    const toolAny = this.originalTool as any;

    // If it's a CoreTool with Vercel v5 wrapper, wrap it properly
    if (isCoreToolWithVercelV5(this.originalTool)) {
      const wrappedTool = toolAny.tool;
      return {
        type: 'vercel-v5-tool',
        tool: wrappedTool,
        description: wrappedTool.description,
        inputSchema: this.getParameters() as T,
        execute: wrappedTool.execute
          ? this.createExecute(wrappedTool, { ...this.options, description: wrappedTool.description }, this.logType)
          : undefined,
      } as CoreTool<T>;
    }

    // If it's a direct Vercel v5 tool, wrap it in our CoreTool format
    if (isVercelV5Tool(this.originalTool)) {
      const vercelTool = this.originalTool as Tool<any, any>;
      return {
        type: 'vercel-v5-tool',
        tool: vercelTool,
        description: vercelTool.description,
        inputSchema: this.getParameters() as T,
        execute: vercelTool.execute
          ? this.createExecute(
              this.originalTool,
              { ...this.options, description: vercelTool.description },
              this.logType,
            )
          : undefined,
      } as CoreTool<T>;
    }

    // Build traditional Mastra tool
    const definition = {
      type: 'function' as const,
      inputSchema: this.getParameters(),
      __isMastraTool: true as const,
      description: this.originalTool.description,
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
      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(model),
        new OpenAISchemaCompatLayer(model),
        new GoogleSchemaCompatLayer(model),
        new AnthropicSchemaCompatLayer(model),
        new DeepSeekSchemaCompatLayer(model),
        new MetaSchemaCompatLayer(model),
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
      inputSchema: processedSchema,
      outputSchema: processedOutputSchema,
    } as CoreTool<T>;
  }
}
