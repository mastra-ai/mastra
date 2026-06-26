import { expect } from './expect.js';
import type { McE2eScenario } from './types.js';

function findTool(requests: unknown[], name: string): Record<string, any> {
  for (const request of requests) {
    const tools = (request as any)?.body?.tools;
    if (!Array.isArray(tools)) continue;

    const tool = tools.find((candidate: any) => candidate?.function?.name === name || candidate?.name === name);
    if (tool) {
      return tool;
    }
  }

  throw new Error(`Expected AIMock request to include ${name} tool schema`);
}

function schemaFor(tool: Record<string, any>): Record<string, any> {
  const schema = tool.function?.parameters ?? tool.inputSchema ?? tool.parameters;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`Expected ${tool.function?.name ?? tool.name} schema to be an object`);
  }

  return schema;
}

function expectObjectSchema(schema: Record<string, any>, label: string): void {
  if (schema.type !== 'object') {
    throw new Error(`Expected ${label} schema type object, received ${String(schema.type)}`);
  }
  if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
    throw new Error(`Expected ${label} schema to expose object properties`);
  }
}

export const toolSchemaCompatScenario: McE2eScenario = {
  name: 'tool-schema-compat',
  description: 'Verify built-in command tool schemas serialize as provider-visible JSON Schema objects.',
  testName: 'sends compatible schemas for built-in command tools',
  useOpenAIModel: true,
  aimockFixture: 'tool-schema-compat.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    runtime.printScreen('spawned', terminal);

    await runtime.waitForScreenText(/Resource ID:/i, terminal);
    // Switch to plan mode so submit_plan is available (it's only offered in
    // modes with `transitionsTo`, i.e. planning modes).
    terminal.submit('/mode plan');
    await runtime.waitForScreenText(/▐plan▌/i, terminal, 8_000);
    terminal.submit('Check built-in tool schema compatibility for provider requests.');
    await runtime.waitForScreenText(/MC tool schema compatibility response/i, terminal);

    terminal.keyCtrlC();
    runtime.printScreen('after Ctrl-C', terminal);
  },
  verifyAimockRequests(requests) {
    const askUserSchema = schemaFor(findTool(requests, 'ask_user'));
    expectObjectSchema(askUserSchema, 'ask_user');
    if (!askUserSchema.properties.question) {
      throw new Error('Expected ask_user schema to include question property');
    }

    const taskWriteSchema = schemaFor(findTool(requests, 'task_write'));
    expectObjectSchema(taskWriteSchema, 'task_write');
    const tasksProperty = taskWriteSchema.properties.tasks;
    if (tasksProperty?.type !== 'array' || tasksProperty.items?.type !== 'object') {
      throw new Error('Expected task_write.tasks to be an array of object items');
    }
    const taskProperties = tasksProperty.items.properties;
    for (const property of ['content', 'status', 'activeForm']) {
      if (!taskProperties?.[property]) {
        throw new Error(`Expected task_write task item schema to include ${property}`);
      }
    }

    const submitPlanSchema = schemaFor(findTool(requests, 'submit_plan'));
    expectObjectSchema(submitPlanSchema, 'submit_plan');
    if (!submitPlanSchema.properties.plan) {
      throw new Error('Expected submit_plan schema to include plan property');
    }

    expect(requests.length).toBeGreaterThan(0);
  },
};
