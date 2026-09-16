import { createRequire } from 'node:module';

import { createTool } from '@mastra/core/tools';
import type { ToolAction } from '@mastra/core/tools';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { JSONSchema7, JSONSchema7Definition, JSONSchema7TypeName } from 'json-schema';

import type { MemoryRecallCodeModeConfig } from '../processors/observational-memory/types';

export const MEMORY_RECALL_CODE_MODE_TOOL_ID = 'execute_memory_recall';
export const MEMORY_RECALL_CODE_MODE_MARKER = '__mastraMemoryRecallCodeMode';

const require = createRequire(import.meta.url);

const codeModeInputSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description:
        'A TypeScript program that orchestrates the available external_* tools and returns a final value. ' +
        'Use Promise.all to batch calls; do arithmetic in JS. End with `return <value>`.',
    },
  },
  required: ['code'],
} satisfies JSONSchema7;

const codeModeOutputSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    result: {},
    logs: { type: 'array', items: { type: 'string' } },
    error: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        name: { type: 'string' },
        line: { type: 'number' },
      },
      required: ['message'],
    },
  },
  required: ['success'],
} satisfies JSONSchema7;

const usageContract = `# Code Mode

You have access to the \`${MEMORY_RECALL_CODE_MODE_TOOL_ID}\` tool. Instead of calling tools one at a time,
write a single TypeScript program that orchestrates them and returns one result.

Rules:
- Call the available tools via the \`external_*\` functions declared below. Each
  returns a Promise — \`await\` it.
- Batch independent calls with \`Promise.all\`. Do arithmetic and data shaping in
  JavaScript, not in your head.
- End the program by \`return\`-ing the final value (objects/arrays are fine).
- The only supported capabilities are the \`external_*\` functions. Do not rely
  on filesystem, network, or process access — depending on the configured
  sandbox and transport, the program may run fully isolated with none of those
  available.
- Use \`console.log\` for debugging; logs are captured and returned.

Available functions:`;

function literal(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  return 'unknown';
}

function normalizeType(type: JSONSchema7['type']): JSONSchema7TypeName | undefined {
  if (Array.isArray(type)) return type.find(value => value !== 'null');
  return type;
}

function isTopLevelUnion(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === '{' || character === '[' || character === '(' || character === '<') depth++;
    else if (character === '}' || character === ']' || character === ')' || character === '>') depth--;
    else if (character === '|' && depth === 0) return true;
  }
  return false;
}

function schemaToType(schema: JSONSchema7Definition | undefined): string {
  if (schema === undefined) return 'unknown';
  if (typeof schema === 'boolean') return schema ? 'unknown' : 'never';
  if (schema.const !== undefined) return literal(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.length ? schema.enum.map(literal).join(' | ') : 'never';

  const union = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(union) && union.length > 0) return union.map(schemaToType).join(' | ');

  const type = normalizeType(schema.type);
  if (type === 'object' || schema.properties) {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const entries = Object.entries(properties);
    if (entries.length === 0) {
      const additional = schema.additionalProperties;
      if (additional !== undefined && additional !== false) {
        return `Record<string, ${typeof additional === 'object' ? schemaToType(additional) : 'unknown'}>`;
      }
      return 'Record<string, unknown>';
    }
    return `{ ${entries
      .map(([key, value]) => {
        const renderedKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        return `${renderedKey}${required.has(key) ? '' : '?'}: ${schemaToType(value)}`;
      })
      .join('; ')} }`;
  }
  if (type === 'array' || schema.items) {
    const items = schema.items;
    if (Array.isArray(items)) return `[${items.map(schemaToType).join(', ')}]`;
    const inner = schemaToType(items);
    return isTopLevelUnion(inner) ? `Array<${inner}>` : `${inner}[]`;
  }

  switch (type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    default:
      return 'unknown';
  }
}

function getJsonSchema(tool: ToolAction<any, any, any>): JSONSchema7 {
  const schema = tool.inputSchema as unknown;
  if (!isStandardSchemaWithJSON(schema)) return {};
  try {
    return standardSchemaToJSONSchema(schema, { io: 'input' }) as JSONSchema7;
  } catch {
    return {};
  }
}

export function createMemoryRecallCodeModeInstructions(recall: ToolAction<any, any, any>): string {
  const description = recall.description ? `/** ${recall.description.replace(/\*\//g, '* /')} */\n` : '';
  const declaration = `${description}declare function external_recall(input: ${schemaToType(
    getJsonSchema(recall),
  )}): Promise<unknown>;`;
  return `${usageContract}\n\n${declaration}`;
}

function installedCoreVersion(): string {
  try {
    return (require('@mastra/core/package.json') as { version?: string }).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function missingCreateCodeModeError(): Error {
  return new Error(
    'Memory-managed Code Mode requires @mastra/core to export createCodeMode. ' +
      `Installed @mastra/core version: ${installedCoreVersion()}. ` +
      'Upgrade @mastra/core to 1.68.0-alpha.0 or newer and keep @mastra/core and @mastra/memory versions aligned.',
  );
}

type CodeModeDelegate = {
  execute?: (input: unknown, context: unknown) => Promise<unknown>;
};

type CreateCodeMode = (
  config: {
    tools: Record<string, ToolAction<any, any, any>>;
    sandbox?: unknown;
    timeout?: number;
    id: string;
  },
  transport?: unknown,
) => { tool: CodeModeDelegate };

export function createMemoryRecallCodeMode(
  recall: ToolAction<any, any, any>,
  config: true | MemoryRecallCodeModeConfig,
): { tool: ToolAction<any, any, any>; instructions: string } {
  const resolved = config === true ? {} : config;
  let delegatePromise: Promise<CodeModeDelegate> | undefined;

  const loadDelegate = () =>
    (delegatePromise ??= import('@mastra/core/tools').then(module => {
      const createCodeMode = (module as unknown as { createCodeMode?: CreateCodeMode }).createCodeMode;
      if (typeof createCodeMode !== 'function') throw missingCreateCodeModeError();
      return createCodeMode(
        {
          tools: { recall },
          sandbox: resolved.sandbox,
          timeout: resolved.timeout,
          id: MEMORY_RECALL_CODE_MODE_TOOL_ID,
        },
        resolved.transport,
      ).tool;
    }));

  const tool = createTool({
    id: MEMORY_RECALL_CODE_MODE_TOOL_ID,
    description:
      'Execute a TypeScript program that transforms bounded Memory recall results in a sandbox. ' +
      'Only external_recall is available.',
    inputSchema: codeModeInputSchema,
    outputSchema: codeModeOutputSchema,
    execute: async (input, context) => {
      const delegate = await loadDelegate();
      if (!delegate.execute) throw new Error('Memory-managed Code Mode delegate is not executable.');
      return delegate.execute(input, context);
    },
  }) as ToolAction<any, any, any> & { [MEMORY_RECALL_CODE_MODE_MARKER]: true };

  tool[MEMORY_RECALL_CODE_MODE_MARKER] = true;

  return {
    tool,
    instructions: createMemoryRecallCodeModeInstructions(recall),
  };
}
