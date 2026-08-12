import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

import { createWorkflowTool } from '../create-workflow.js';
import { runWorkflowTool } from '../run-workflow.js';
import { saveWorkflowTool } from '../save-workflow.js';
import { createWorkflowBuilderAgentStub } from './workflow-builder-agent-stub.js';

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
});

const stringSchema = { type: 'string' };
const numberSchema = { type: 'number' };

const scenarios = [
  {
    id: 'portable-echo-workflow',
    input: { message: 'Hello' },
    expected: { message: 'Hello' },
    definition: {
      id: 'portable-echo-workflow',
      inputSchema: objectSchema({ message: stringSchema }, ['message']),
      outputSchema: objectSchema({ message: stringSchema }, ['message']),
      graph: [{ type: 'mapping', id: 'echo-message', mapConfig: { message: { initData: true, path: 'message' } } }],
    },
  },
  {
    id: 'portable-greeting-workflow',
    input: { name: 'Ada' },
    expected: { message: 'Hello, Ada!' },
    definition: {
      id: 'portable-greeting-workflow',
      inputSchema: objectSchema({ name: stringSchema }, ['name']),
      outputSchema: objectSchema({ message: stringSchema }, ['message']),
      graph: [
        { type: 'mapping', id: 'format-greeting', mapConfig: { message: { template: 'Hello, ${initData.name}!' } } },
      ],
    },
  },
  {
    id: 'portable-order-status-workflow',
    input: { orderId: 'order-123' },
    expected: { orderId: 'order-123', status: 'received' },
    definition: {
      id: 'portable-order-status-workflow',
      inputSchema: objectSchema({ orderId: stringSchema }, ['orderId']),
      outputSchema: objectSchema({ orderId: stringSchema, status: stringSchema }, ['orderId', 'status']),
      graph: [
        {
          type: 'mapping',
          id: 'shape-order-status',
          mapConfig: { orderId: { initData: true, path: 'orderId' }, status: { value: 'received' } },
        },
      ],
    },
  },
  {
    id: 'portable-profile-workflow',
    input: { name: 'Ada', age: 37 },
    expected: { name: 'Ada', age: 37 },
    definition: {
      id: 'portable-profile-workflow',
      inputSchema: objectSchema({ name: stringSchema, age: numberSchema }, ['name', 'age']),
      outputSchema: objectSchema({ name: stringSchema, age: numberSchema }, ['name', 'age']),
      graph: [
        {
          type: 'mapping',
          id: 'project-profile',
          mapConfig: { name: { initData: true, path: 'name' }, age: { initData: true, path: 'age' } },
        },
      ],
    },
  },
  {
    id: 'portable-tags-workflow',
    input: { tags: ['urgent', 'customer'] },
    expected: { tags: ['urgent', 'customer'] },
    definition: {
      id: 'portable-tags-workflow',
      inputSchema: objectSchema({ tags: { type: 'array', items: stringSchema } }, ['tags']),
      outputSchema: objectSchema({ tags: { type: 'array', items: stringSchema } }, ['tags']),
      graph: [{ type: 'mapping', id: 'copy-tags', mapConfig: { tags: { initData: true, path: 'tags' } } }],
    },
  },
  {
    id: 'portable-chained-mapping-workflow',
    input: { value: 'portable' },
    expected: { result: 'portable' },
    definition: {
      id: 'portable-chained-mapping-workflow',
      inputSchema: objectSchema({ value: stringSchema }, ['value']),
      outputSchema: objectSchema({ result: stringSchema }, ['result']),
      graph: [
        {
          type: 'mapping',
          id: 'normalize-value',
          mapConfig: { normalizedValue: { initData: true, path: 'value' } },
        },
        {
          type: 'mapping',
          id: 'copy-normalized-value',
          mapConfig: { result: { step: 'normalize-value', path: 'normalizedValue' } },
        },
      ],
    },
  },
  {
    id: 'portable-receipt-workflow',
    input: { item: 'notebook', quantity: 2 },
    expected: { summary: 'Ordered 2 x notebook' },
    definition: {
      id: 'portable-receipt-workflow',
      inputSchema: objectSchema({ item: stringSchema, quantity: numberSchema }, ['item', 'quantity']),
      outputSchema: objectSchema({ summary: stringSchema }, ['summary']),
      graph: [
        {
          type: 'mapping',
          id: 'format-receipt',
          mapConfig: { summary: { template: 'Ordered ${initData.quantity} x ${initData.item}' } },
        },
      ],
    },
  },
  {
    id: 'portable-defaults-workflow',
    input: {},
    expected: { enabled: true, retries: 3, mode: 'safe' },
    definition: {
      id: 'portable-defaults-workflow',
      inputSchema: objectSchema({}),
      outputSchema: {},
      graph: [
        {
          type: 'mapping',
          id: 'create-defaults',
          mapConfig: { enabled: { value: true }, retries: { value: 3 }, mode: { value: 'safe' } },
        },
      ],
    },
  },
] as const;

describe('Mastra Code portable Workflow Builder prompt lifecycle', () => {
  describe('when definitions require no registered tools, agents, or workflows', () => {
    it.each(scenarios)(
      'persists and runs $id with the expected output',
      async ({ definition, expected, id, input }) => {
        const mastra = new Mastra({
          logger: false,
          storage: new InMemoryStore({ id: `portable-prompt-${id}` }),
        });
        const parsedDefinition = (saveWorkflowTool as any).inputSchema.parse(definition);
        const workflowBuilder = createWorkflowBuilderAgentStub(mastra, parsedDefinition);
        const createResult = await (createWorkflowTool as any).execute(
          { request: `Create ${id}.` },
          {
            mastra: {
              getAgent: (agentId: string) => (agentId === 'workflow-builder' ? workflowBuilder : undefined),
            },
            requestContext: new RequestContext(),
          },
        );
        const run = (await (runWorkflowTool as any).execute(
          { workflowId: id, inputData: input },
          { mastra, requestContext: new RequestContext() },
        )) as { status: string; result?: unknown; error?: unknown };

        expect(createResult).toEqual({ summary: `Built ${id}.`, workflowId: id });
        expect(run.status, JSON.stringify(run.error)).toBe('success');
        expect(run.result).toEqual(expected);
      },
    );
  });
});
