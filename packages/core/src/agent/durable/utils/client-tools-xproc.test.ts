/**
 * Call-time clientTools must survive a cross-process durable run (#25499).
 *
 * On engines like Inngest the worker runs in a different process than the
 * caller, so the worker's run registry is empty and tools are rebuilt from the
 * Mastra instance. Client tools are call-time only, so they must ride on the
 * serialized workflow options and be passed back into the rebuild.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { globalRunRegistry } from '../run-registry';
import { rebuildRunToolsFromMastra } from './resolve-runtime';
import { serializeClientTools, serializeDurableOptions } from './serialize-state';

const RUN_ID = 'run-client-tools-xproc';

afterEach(() => {
  globalRunRegistry.delete(RUN_ID);
});

describe('cross-process client tools', () => {
  it('serializes client tools into options and restores them on rebuild', async () => {
    const agent = new Agent({
      id: 'weather-agent',
      name: 'weather-agent',
      instructions: 'test',
      model: new MockLanguageModelV2(),
    });
    const mastra = new Mastra({ agents: { agent }, logger: false });

    const clientTools = {
      lookup_weather: createTool({
        id: 'lookup_weather',
        description: 'Look up the weather',
        inputSchema: z.object({ city: z.string() }),
      }),
    };

    // Caller process: convert + serialize, as preparation.ts does.
    const callerTools = await mastra.getAgentById('weather-agent').getToolsForExecution({
      runId: RUN_ID,
      clientTools,
    } as any);
    const options = serializeDurableOptions({ clientTools: serializeClientTools(clientTools, callerTools) });

    // Must be JSON-safe to ride on the workflow input.
    const wireOptions = JSON.parse(JSON.stringify(options));
    expect(wireOptions.clientTools.lookup_weather.description).toBe('Look up the weather');
    expect(wireOptions.clientTools.lookup_weather.inputSchema.properties.city).toBeDefined();

    // Worker process: empty registry, rebuild from Mastra.
    expect(globalRunRegistry.has(RUN_ID)).toBe(false);
    const rebuilt = await rebuildRunToolsFromMastra({
      mastra,
      runId: RUN_ID,
      agentId: 'weather-agent',
      state: { threadId: undefined, resourceId: undefined } as any,
      options: wireOptions,
    });

    const tool = rebuilt?.tools.lookup_weather as any;
    expect(tool).toBeDefined();
    expect(tool.description).toBe('Look up the weather');
    expect(tool.execute).toBeUndefined();
  });

  it('omits clientTools when none were provided', () => {
    expect(serializeClientTools(undefined, {})).toBeUndefined();
  });
});
