import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMastraCodeModule } from './types.js';
import type { McE2eScenario } from './types.js';

function visit(value: unknown, visitor: (value: any) => void): void {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, visitor);
    return;
  }
  for (const child of Object.values(value as Record<string, unknown>)) visit(child, visitor);
}

function findStrictProbeSchema(requests: unknown[]) {
  let schema: any;
  visit(requests, value => {
    if (schema) return;
    if (value?.type === 'function' && value?.function?.name === 'strict_schema_probe') {
      schema = value.function.parameters;
    }
  });
  return schema;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sortedKeys(value: any): string[] {
  return Object.keys(value ?? {}).sort();
}

export const openaiStrictSchemaScenario: McE2eScenario = {
  name: 'openai-strict-schema',
  description: 'Verify OpenAI AIMock requests from the real TUI receive strict-compatible optional tool schemas.',
  testName: 'sends strict OpenAI-compatible optional tool schemas from a TUI prompt',
  useOpenAIModel: true,
  aimockFixture: 'openai-strict-schema.json',
  prepare({ mastracodeDir, projectDir, harnessBackend }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-openai-strict-entrypoint.ts'),
      `import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, '${createMastraCodeModule(harnessBackend)}')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

const strictSchemaProbeTool = createTool({
  id: 'strict_schema_probe',
  description: 'E2E-only OpenAI strict schema probe with optional nested fields.',
  inputSchema: z.object({
    requiredLabel: z.string().describe('Required label'),
    optionalNote: z.string().optional().describe('Optional note that must become required for OpenAI strict mode'),
    nested: z.object({
      enabled: z.boolean().optional().describe('Optional nested boolean'),
      count: z.number().optional().describe('Optional nested number'),
    }).optional().describe('Optional nested object that must become required recursively'),
  }),
  execute: async () => ({ ok: true }),
});

const result = await createMastraCode({
  cwd: process.cwd(),
  disableMcp: true,
  disableHooks: true,
  unixSocketPubSub: false,
  memory: false,
  extraTools: { strict_schema_probe: strictSchemaProbeTool },
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  process.exit(1);
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-openai-strict-entrypoint.ts');
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
    await runtime.sleep(300);
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const schema = findStrictProbeSchema(requests);
    check(schema, JSON.stringify(requests.map((request: any) => request.body)));
    check(schema.type === 'object', `Expected strict_schema_probe schema type object, received ${schema.type}`);
    check(
      schema.additionalProperties === false,
      `Expected strict_schema_probe additionalProperties false, received ${schema.additionalProperties}`,
    );
    check(
      JSON.stringify([...schema.required].sort()) === JSON.stringify(sortedKeys(schema.properties)),
      `Expected all strict_schema_probe properties to be required, received required=${JSON.stringify(schema.required)} properties=${JSON.stringify(sortedKeys(schema.properties))}`,
    );

    const nested = schema.properties?.nested;
    check(nested?.properties, `Expected nested to keep object properties, received ${JSON.stringify(nested)}`);
    check(nested.additionalProperties === false, 'Expected nested additionalProperties false');
    check(
      JSON.stringify([...nested.required].sort()) === JSON.stringify(sortedKeys(nested.properties)),
      `Expected all nested properties to be required, received required=${JSON.stringify(nested.required)} properties=${JSON.stringify(sortedKeys(nested.properties))}`,
    );
  },
};
