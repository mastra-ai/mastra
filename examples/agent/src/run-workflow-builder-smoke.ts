/**
 * End-to-end smoke for the workflow-builder pipeline (no LLM).
 *
 * Exercises the same APIs the CLI's `save-and-register` and `/run` tools use,
 * across two Mastra instances sharing one InMemoryStore. Proves:
 *
 *   1. `addStoredWorkflow` persists + live-registers a workflow that's
 *      immediately runnable in the same process.
 *   2. A fresh Mastra wired to the same storage rehydrates the workflow on
 *      `startWorkers()` and runs it identically.
 */
try {
  process.loadEnvFile();
} catch {
  /* no .env present */
}

import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { weatherTool } from './mastra/tools/weather-tool';

console.log('[smoke 1/4] building shared in-memory store');
const storage = new InMemoryStore({ id: 'wb-smoke-store' });

const inputSchema = {
  type: 'object',
  properties: { location: { type: 'string' } },
  required: ['location'],
};
const outputSchema = {
  type: 'object',
  properties: { headline: { type: 'string' } },
  required: ['headline'],
};

const graph: SerializedStepFlowEntry[] = [
  { type: 'tool', id: 'get-weather', toolId: 'get-weather' },
  {
    type: 'mapping',
    id: 'mapping_0',
    mapConfig: JSON.stringify({
      headline: {
        template: '${inputData.location}: ${inputData.conditions} at ${inputData.temperature}°C',
      },
    }),
  },
];

console.log('[smoke 2/4] mastra A: addStoredWorkflow + immediate run');
const mastraA = new Mastra({
  logger: false,
  tools: { 'get-weather': weatherTool } as any,
  storage,
});

await mastraA.addStoredWorkflow({
  id: 'cli-weather-smoke',
  description: 'Fetches weather, returns a one-line headline.',
  inputSchema,
  outputSchema,
  graph,
});

const wfA = mastraA.getWorkflow('cli-weather-smoke');
if (!wfA) throw new Error('mastra A: workflow not registered after addStoredWorkflow');
const runA = await wfA.createRun();
const resultA = await runA.start({ inputData: { location: 'Helsinki' } });
if (resultA.status !== 'success') {
  console.error('mastra A: run failed', resultA);
  process.exit(1);
}
console.log('[smoke 2/4] ✅ result A:', JSON.stringify((resultA as any).result));

console.log('[smoke 3/4] mastra B: fresh instance, startWorkers should rehydrate');
const mastraB = new Mastra({
  logger: false,
  tools: { 'get-weather': weatherTool } as any,
  storage,
});
await mastraB.startWorkers();

const wfB = mastraB.getWorkflow('cli-weather-smoke');
if (!wfB) {
  console.error('mastra B: workflow not registered after startWorkers — loadStoredWorkflows did not pick up the row');
  process.exit(1);
}
const runB = await wfB.createRun();
const resultB = await runB.start({ inputData: { location: 'Reykjavik' } });
if (resultB.status !== 'success') {
  console.error('mastra B: run failed', resultB);
  process.exit(1);
}
console.log('[smoke 3/4] ✅ result B:', JSON.stringify((resultB as any).result));

console.log('[smoke 4/4] /list-equivalent: listing stored definitions');
const store = await mastraB.getStorage()?.getStore('workflowDefinitions');
if (!store) {
  console.error('workflow-definitions store missing on mastra B');
  process.exit(1);
}
const { definitions } = await store.list({ status: 'active' });
console.log(`[smoke 4/4] ✅ ${definitions.length} stored workflow(s):`);
for (const d of definitions) console.log(`  - ${d.id} — ${d.description ?? ''}`);

console.log('\nALL GREEN');
process.exit(0);
