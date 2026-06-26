import { Readable } from 'node:stream';
import type { ToolsInput } from '@internal/voice';
import { isZodType, standardSchemaToJSONSchema, toStandardSchema } from '@mastra/schema-compat';
import { zodToJsonSchema } from '@mastra/schema-compat/zod-to-json';
import type { XAIFunctionTool } from './types';

type ToolInvocationOptions = {
  toolCallId: string;
  messages: unknown[];
  requestContext?: unknown;
};

type ToolExecute = (args: unknown, options: ToolInvocationOptions) => unknown;

export type XAIExecuteFunction = (
  args: unknown,
  options: { toolCallId: string; requestContext?: unknown },
) => Promise<unknown>;
export type XAITransformedTool = { xaiTool: XAIFunctionTool; execute: XAIExecuteFunction };

/**
 * Minimal logger contract accepted by {@link transformTools}. Pass the
 * voice provider's `this.logger` from inside the class so warnings respect
 * the configured Mastra log level instead of writing to stdout/stderr
 * unconditionally.
 */
export type XAITransformToolsLogger = { warn(message: string): void };

export const isReadableStream = (obj: unknown): obj is NodeJS.ReadableStream => {
  return (
    !!obj &&
    obj instanceof Readable &&
    typeof obj.read === 'function' &&
    typeof obj.pipe === 'function' &&
    obj.readable === true
  );
};

export const int16ArrayToBase64 = (int16Array: Int16Array): string => {
  const buffer = new ArrayBuffer(int16Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < int16Array.length; i++) {
    // xAI's documented PCM format is Linear16 little-endian.
    view.setInt16(i * 2, int16Array[i]!, true);
  }
  return Buffer.from(buffer).toString('base64');
};

export const readableToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const readableToBase64 = async (stream: NodeJS.ReadableStream): Promise<string> => {
  return (await readableToBuffer(stream)).toString('base64');
};

export const transformTools = (tools?: ToolsInput, logger: XAITransformToolsLogger = console) => {
  const xaiTools: XAITransformedTool[] = [];

  for (const [name, tool] of Object.entries(tools || {})) {
    let parameters: Record<string, unknown>;

    try {
      if ('inputSchema' in tool && tool.inputSchema) {
        parameters = schemaToJsonSchema(tool.inputSchema);
      } else if ('parameters' in tool && tool.parameters) {
        parameters = schemaToJsonSchema(tool.parameters);
      } else {
        continue;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to transform xAI realtime tool "${name}" schema: ${message}`);
    }

    if (!tool.execute) {
      logger.warn(`Skipping xAI realtime tool "${name}" because it has no execute function.`);
      continue;
    }

    xaiTools.push({
      xaiTool: {
        type: 'function',
        name,
        description: tool.description || `Tool: ${name}`,
        parameters,
      },
      execute: async (args, options) => {
        if (!tool.execute) {
          throw new Error(`Tool ${name} has no execute function`);
        }

        const execute = tool.execute as ToolExecute;
        const callOptions = {
          toolCallId: options.toolCallId,
          messages: [],
          requestContext: options.requestContext,
        } satisfies ToolInvocationOptions;

        return execute(args, callOptions);
      },
    });
  }

  return xaiTools;
};

function schemaToJsonSchema(schema: unknown): Record<string, unknown> {
  let jsonSchema: Record<string, unknown>;

  if (isZodType(schema)) {
    jsonSchema = zodToJsonSchema(schema) as Record<string, unknown>;
  } else {
    jsonSchema = standardSchemaToJSONSchema(toStandardSchema(schema as any), { io: 'input' }) as Record<
      string,
      unknown
    >;
  }

  delete jsonSchema.$schema;
  return jsonSchema;
}
