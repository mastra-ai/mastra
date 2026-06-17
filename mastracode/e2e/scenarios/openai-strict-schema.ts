import { z } from 'zod/v3';
import type { McE2eScenario } from './types.js';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function visit(value: unknown, visitor: (value: JsonObject) => void): void {
  if (!value || typeof value !== 'object') return;
  if (isObject(value)) visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  for (const child of Object.values(value as JsonObject)) visit(child, visitor);
}

function getRequestBody(request: unknown): unknown {
  return isObject(request) && 'body' in request ? request.body : undefined;
}

function findStrictProbeSchema(requests: unknown[]): JsonObject | undefined {
  let schema: JsonObject | undefined;
  visit(requests, value => {
    const functionValue = isObject(value.function) ? value.function : undefined;
    if (schema || value.type !== 'function' || functionValue?.name !== 'strict_schema_probe') return;
    schema = isObject(functionValue.parameters) ? functionValue.parameters : undefined;
  });
  return schema;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sortedKeys(value: unknown): string[] {
  return isObject(value) ? Object.keys(value).sort() : [];
}

function requiredKeys(schema: JsonObject): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string').sort()
    : [];
}

const strictSchemaProbeTool = {
  id: 'strict_schema_probe',
  description: 'E2E-only OpenAI strict schema probe with optional nested fields.',
  inputSchema: z.object({
    requiredLabel: z.string().describe('Required label'),
    optionalNote: z.string().optional().describe('Optional note that must become required for OpenAI strict mode'),
    nested: z
      .object({
        enabled: z.boolean().optional().describe('Optional nested boolean'),
        count: z.number().optional().describe('Optional nested number'),
      })
      .optional()
      .describe('Optional nested object that must become required recursively'),
  }),
  execute: async () => ({ ok: true }),
};

export const openaiStrictSchemaScenario = {
  name: 'openai-strict-schema',
  description: 'Verify OpenAI AIMock requests from the real TUI receive strict-compatible optional tool schemas.',
  testName: 'sends strict OpenAI-compatible optional tool schemas from a TUI prompt',
  useOpenAIModel: true,
  aimockFixture: 'openai-strict-schema.json',
  inProcessApp({ startMastraCodeApp }) {
    return startMastraCodeApp({
      config: {
        disableHooks: true,
        disableMcp: true,
        extraTools: { strict_schema_probe: strictSchemaProbeTool },
        unixSocketPubSub: false,
      },
    });
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    runtime.printScreen('after startup', terminal);

    terminal.submit('Check OpenAI strict schema compatibility for available tools.');
    await runtime.waitForScreenText(/MC OpenAI strict schema compatibility response/i, terminal);
    runtime.printScreen('after strict-schema prompt', terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const schema = findStrictProbeSchema(requests);
    check(schema, JSON.stringify(requests.map(getRequestBody)));
    check(schema.type === 'object', `Expected strict_schema_probe schema type object, received ${String(schema.type)}`);
    check(
      schema.additionalProperties === false,
      `Expected strict_schema_probe additionalProperties false, received ${String(schema.additionalProperties)}`,
    );
    check(
      JSON.stringify(requiredKeys(schema)) === JSON.stringify(sortedKeys(schema.properties)),
      `Expected all strict_schema_probe properties to be required, received required=${JSON.stringify(schema.required)} properties=${JSON.stringify(sortedKeys(schema.properties))}`,
    );

    const properties = isObject(schema.properties) ? schema.properties : undefined;
    const nested = isObject(properties?.nested) ? properties.nested : undefined;
    check(
      nested && isObject(nested.properties),
      `Expected nested to keep object properties, received ${JSON.stringify(nested)}`,
    );
    check(nested.additionalProperties === false, 'Expected nested additionalProperties false');
    check(
      JSON.stringify(requiredKeys(nested)) === JSON.stringify(sortedKeys(nested.properties)),
      `Expected all nested properties to be required, received required=${JSON.stringify(nested.required)} properties=${JSON.stringify(sortedKeys(nested.properties))}`,
    );
  },
} satisfies McE2eScenario;
