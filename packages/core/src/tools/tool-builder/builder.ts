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
import { MastraBase } from '../../base';
import { ErrorCategory, MastraError, ErrorDomain } from '../../error';
import { RuntimeContext } from '../../runtime-context';
import { isVercelTool } from '../../tools/toolchecks';
import type { ToolOptions } from '../../utils';
import type { CoreTool, ToolAction, VercelTool } from '../types';

export type ToolToConvert = VercelTool | ToolAction<any, any, any>;
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

  // For provider-defined tools, we need to include all required properties
  private buildProviderTool(tool: ToolToConvert): (CoreTool & { id: `${string}.${string}` }) | undefined {
    if (
      'type' in tool &&
      tool.type === 'provider-defined' &&
      'id' in tool &&
      typeof tool.id === 'string' &&
      tool.id.includes('.')
    ) {
      return {
        type: 'provider-defined' as const,
        id: tool.id,
        args: ('args' in this.originalTool ? this.originalTool.args : {}) as Record<string, unknown>,
        description: tool.description,
        parameters: convertZodSchemaToAISDKSchema(this.getParameters()),
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

    const execFunction = async (args: any, execOptions: ToolExecutionOptions) => {
      if (isVercelTool(tool)) {
        return tool?.execute?.(args, execOptions) ?? undefined;
      }

      return (
        tool?.execute?.(
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
        throw mastraError;
      }
    };
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

    return {
      ...definition,
      parameters: processedSchema,
    };
  }
}
