/**
 * End-to-end smoke for the libsql-backed workflow-builder pipeline.
 *
 * Unlike the in-memory smoke, this one uses a real on-disk libsql file. We
 * open two Mastra instances sequentially, closing the first before the second
 * opens, to prove the workflow definition survives a process-equivalent
 * restart (same db file, no shared in-process state).
 */
try {
  process.loadEnvFile();
} catch {
  /* no .env present */
}

import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { weatherTool } from './mastra/tools/weather-tool';

const tmp = await mkdtemp(join(tmpdir(), 'wb-libsql-smoke-'));
const dbPath = join(tmp, 'wb.db');
const dbUrl = `file:${dbPath}`;
console.log(`[smoke] using libsql db at ${dbPath}`);

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
      headline: { template: '${inputData.location}: ${inputData.conditions} at ${inputData.temperature}°C' },
    }),
  },
];

// ----- Phase 1: build + save + run in the original process -----
{
  console.log('[phase 1] opening Mastra against fresh libsql file');
  const storage = new LibSQLStore({ id: 'wb-libsql-smoke', url: dbUrl });
  const mastra = new Mastra({ logger: false, tools: { 'get-weather': weatherTool } as any, storage });

  await mastra.addStoredWorkflow({
    id: 'libsql-weather-smoke',
    description: 'Fetches weather; returns one-line headline. Persisted to libsql.',
    inputSchema,
    outputSchema,
    graph,
  });

  const wf = mastra.getWorkflow('libsql-weather-smoke');
  if (!wf) throw new Error('phase 1: workflow not registered after addStoredWorkflow');
  const result = await (await wf.createRun()).start({ inputData: { location: 'Helsinki' } });
  if (result.status !== 'success') {
    console.error('phase 1: run failed', result);
    process.exit(1);
  }
  console.log('[phase 1] ✅ saved + ran:', JSON.stringify((result as any).result));

  await storage.close();
}

// ----- Phase 2: brand-new Mastra, same db file -----
{
  console.log('[phase 2] reopening Mastra against the same libsql file');
  const storage = new LibSQLStore({ id: 'wb-libsql-smoke-reopen', url: dbUrl });
  const mastra = new Mastra({ logger: false, tools: { 'get-weather': weatherTool } as any, storage });

  // No addStoredWorkflow here — startWorkers must rehydrate from storage.
  await mastra.startWorkers();

  const wf = mastra.getWorkflow('libsql-weather-smoke');
  if (!wf) {
    console.error('phase 2: workflow NOT registered after startWorkers — loadStoredWorkflows did not run or saw an empty table');
    process.exit(1);
  }
  const result = await (await wf.createRun()).start({ inputData: { location: 'Reykjavik' } });
  if (result.status !== 'success') {
    console.error('phase 2: run failed', result);
    process.exit(1);
  }
  console.log('[phase 2] ✅ rehydrated + ran:', JSON.stringify((result as any).result));

  await mastra.stopWorkers?.();
  await storage.close();
}

await rm(tmp, { recursive: true, force: true });
console.log('\nALL GREEN');
process.exit(0);
