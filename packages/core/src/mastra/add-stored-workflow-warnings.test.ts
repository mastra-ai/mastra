/**
 * Two-sided contract for stored workflows and unsupported JSON Schema
 * keywords:
 *
 *   Save path (`Mastra.addStoredWorkflow`) is STRICT — throws before touching
 *   storage or registry. The author is right there and can simplify.
 *
 *   Boot path (`#loadStoredWorkflows`, exercised via `startWorkers()`) is
 *   LENIENT — degrades the offending schema to `z.any()`, emits a warning,
 *   and keeps registering the workflow so one bad pre-existing row can't
 *   take down startup for every other workflow.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage';
import { createTool } from '../tools';
import { Mastra } from './index';

const passthroughTool = createTool({
  id: 'passthrough-tool',
  description: 'Returns its input as output',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ value: z.number() }),
  execute: async input => input,
});

function stubAgent(id: string) {
  return new Agent({
    id,
    name: id,
    instructions: 'stub',
    model: new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream(),
      }),
    }),
  });
}

describe('Mastra.addStoredWorkflow — save path is strict on unsupported schema keywords', () => {
  it('accepts a workflow whose schemas are all supported', async () => {
    const storage = new InMemoryStore({ id: 'clean-schemas' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'clean-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        graph: [{ type: 'tool', id: 'passthrough-tool', toolId: 'passthrough-tool' }],
      }),
    ).resolves.toBeUndefined();

    expect(mastra.getWorkflow('clean-wf')).toBeDefined();
  });

  it('ignores runtime request context values outside the persisted workflow definition', async () => {
    const storage = new InMemoryStore({ id: 'runtime-request-context' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });
    const definitionWithRuntimeContext = {
      id: 'request-context-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      requestContextSchema: {
        type: 'object',
        properties: { tenantId: { type: 'string' } },
        required: ['tenantId'],
      },
      graph: [{ type: 'tool' as const, id: 'passthrough-tool', toolId: 'passthrough-tool' }],
      requestContext: new Map([['tenantId', 'tenant-1']]),
    };

    await expect(mastra.addStoredWorkflow(definitionWithRuntimeContext)).resolves.toBeUndefined();
    expect(mastra.getWorkflow('request-context-wf')).toBeDefined();
  });

  it('throws when top-level outputSchema uses oneOf, before touching storage', async () => {
    const storage = new InMemoryStore({ id: 'top-oneof' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'oneof-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { oneOf: [{ type: 'string' }, { type: 'number' }] } as any,
        graph: [{ type: 'tool', id: 'passthrough-tool', toolId: 'passthrough-tool' }],
      }),
    ).rejects.toThrow(/addStoredWorkflow refused.*outputSchema.*oneOf/s);

    // Not registered, not persisted.
    expect(() => mastra.getWorkflow('oneof-wf')).toThrow();
  });

  it('throws when a per-step agent outputSchema (reachable through parallel) uses anyOf', async () => {
    const storage = new InMemoryStore({ id: 'nested-anyof' });
    const mastra = new Mastra({
      logger: false,
      agents: { 'my-agent': stubAgent('my-agent') } as any,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'nested-anyof-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        graph: [
          {
            type: 'parallel',
            id: 'parallel-1',
            steps: [
              { type: 'tool', id: 'passthrough-tool', toolId: 'passthrough-tool' },
              {
                type: 'agent',
                id: 'my-agent-step',
                agentId: 'my-agent',
                outputSchema: { anyOf: [{ type: 'string' }, { type: 'number' }] } as any,
              },
            ],
          } as any,
        ],
      }),
    ).rejects.toThrow(/addStoredWorkflow refused.*my-agent-step.*anyOf/s);
  });

  it('preserves the current live registration when durable persistence fails', async () => {
    const storage = new InMemoryStore({ id: 'atomic-publication' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });
    const definition = {
      id: 'atomic-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      outputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      graph: [{ type: 'tool' as const, id: 'passthrough-tool', toolId: 'passthrough-tool' }],
    };

    await mastra.addStoredWorkflow(definition);
    const previousWorkflow = mastra.getWorkflow('atomic-wf');
    const store = await storage.getStore('workflowDefinitions');
    vi.spyOn(store!, 'upsert').mockRejectedValueOnce(new Error('durable write failed'));

    await expect(mastra.addStoredWorkflow({ ...definition, description: 'replacement' })).rejects.toThrow(
      'durable write failed',
    );
    expect(mastra.getWorkflow('atomic-wf')).toBe(previousWorkflow);
  });

  it('rejects a structurally valid definition that cannot execute, before registration', async () => {
    const storage = new InMemoryStore({ id: 'invalid-executable-definition' });
    const mastra = new Mastra({
      logger: false,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });

    await expect(
      mastra.addStoredWorkflow({
        id: 'invalid-executable-wf',
        inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
        outputSchema: { type: 'object' },
        graph: [
          {
            type: 'parallel',
            id: 'parallel-1',
            steps: [
              {
                type: 'mapping',
                id: 'nested-mapping',
                mapConfig: JSON.stringify({ value: { value: { initData: true, path: 'value' } } }),
              },
            ],
          },
        ],
      } as any),
    ).rejects.toThrow(/addStoredWorkflow refused.*mapping steps must be top-level workflow entries/s);

    expect(() => mastra.getWorkflow('invalid-executable-wf')).toThrow();
  });
});

describe('Mastra boot load — lenient on unsupported schema keywords', () => {
  it('degrades unsupported top-level outputSchema to z.any(), warns, and still registers the workflow', async () => {
    const storage = new InMemoryStore({ id: 'boot-lenient' });

    // Seed a bad row directly into storage (bypassing addStoredWorkflow so we
    // simulate a definition saved by a prior version that predated stricter
    // save-path validation).
    const store = await storage.getStore('workflowDefinitions');
    if (!store) throw new Error('workflowDefinitions store not available');
    await store.upsert({
      id: 'legacy-oneof-wf',
      inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] },
      // oneOf is unsupported — jsonSchemaToZod would throw in strict mode.
      outputSchema: { oneOf: [{ type: 'string' }, { type: 'number' }] } as any,
      graph: [{ type: 'tool', id: 'passthrough-tool', toolId: 'passthrough-tool' }],
    });

    const warn = vi.fn();
    const mastra = new Mastra({
      logger: {
        warn,
        info: () => {},
        debug: () => {},
        error: () => {},
        trackException: () => {},
      } as any,
      tools: { 'passthrough-tool': passthroughTool } as any,
      storage,
    });

    // Kick the boot-time loader.
    await (mastra as any).startWorkers?.();

    // Workflow is registered despite the unsupported keyword.
    expect(mastra.getWorkflow('legacy-oneof-wf')).toBeDefined();

    // A warning was emitted naming the offense.
    const messages = warn.mock.calls.map(c => String(c[0]));
    expect(messages.some(m => /legacy-oneof-wf.*oneOf/.test(m))).toBe(true);
  });
});
