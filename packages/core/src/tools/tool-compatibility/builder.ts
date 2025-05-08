import type { ToolExecutionOptions } from 'ai';
import { jsonSchema } from 'ai';
import type { JSONSchema7 } from 'json-schema';
import jsonSchemaToZod from 'json-schema-to-zod';
import type { ZodSchema } from 'zod';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { MastraBase } from '../../base';
import { RuntimeContext } from '../../runtime-context';
import { isVercelTool, isZodType, resolveSerializedZodOutput } from '../../utils';
import type { ToolOptions } from '../../utils';
import type { CoreTool, ToolAction, VercelTool } from '../types';
import { AnthropicToolCompat } from './provider-compats/anthropic';
import { DeepSeekToolCompat } from './provider-compats/deepseek';
import { GoogleToolCompat } from './provider-compats/google';
import { MetaToolCompat } from './provider-compats/meta';
import { OpenAIToolCompat } from './provider-compats/openai';
import { OpenAIReasoningToolCompat } from './provider-compats/openai-reasoning';

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

// mirrors https://github.com/vercel/ai/blob/main/packages/ui-utils/src/zod-schema.ts#L21 but with a custom target
export function convertZodSchemaToAISDKSchema(zodSchema: ZodSchema, target: Targets = 'jsonSchema7') {
  return jsonSchema(
    zodToJsonSchema(zodSchema, {
      $refStrategy: 'none',
      target,
    }) as JSONSchema7,
    {
      validate: value => {
        const result = zodSchema.safeParse(value);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    },
  );
}

export function convertVercelToolParameters(tool: VercelTool): z.ZodType {
  // If the tool is a Vercel Tool, check if the parameters are already a zod object
  // If not, convert the parameters to a zod object using jsonSchemaToZod
  const schema = tool.parameters ?? z.object({});
  return isZodType(schema) ? schema : resolveSerializedZodOutput(jsonSchemaToZod(schema));
}

function convertInputSchema(tool: ToolAction<any, any, any>): z.ZodType {
  const schema = tool.inputSchema ?? z.object({});
  return isZodType(schema) ? schema : resolveSerializedZodOutput(jsonSchemaToZod(schema));
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
      return convertVercelToolParameters(this.originalTool);
    }

    return convertInputSchema(this.originalTool);
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
      try {
        (options.logger || this.logger).debug(start, { ...rest, args });
        return await execFunction(args, execOptions);
      } catch (err) {
        (options.logger || this.logger).error(error, { ...rest, error: err, args });
        throw err;
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

    if (model) {
      for (const compat of [
        new OpenAIReasoningToolCompat(model),
        new OpenAIToolCompat(model),
        new GoogleToolCompat(model),
        new AnthropicToolCompat(model),
        new DeepSeekToolCompat(model),
        new MetaToolCompat(model),
      ]) {
        if (compat.shouldApply()) {
          return { ...definition, ...compat.process(this.originalTool) };
        }
      }
    }

    return { ...definition, parameters: convertZodSchemaToAISDKSchema(this.getParameters()) };
  }
}
