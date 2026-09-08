import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { registerShipyardMaintenanceImporter, shipyardImportBinding } from './shipyard-importer.js';
import { createShipyardMaintenanceAgent } from './shipyard-maintenance.js';
import { createShipyardKnowledge } from './shipyard.js';

assert(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required for the native maintenance-goal proof');
const outIndex = process.argv.indexOf('--out');
assert(outIndex >= 0 && process.argv[outIndex + 1], '--out is required');
const output = resolve(process.argv[outIndex + 1]!);
await mkdir(output, { recursive: true });
const storage = new LibSQLStore({ id: 'shipyard-goal-proof', url: `file:${resolve(output, 'goal.db')}` });
const { knowledge, scopes } = await createShipyardKnowledge(storage);
const expected = 'Verified fixture: curation uses host-bound authority.';
let repairCalls = 0;
let judgeReads = 0;
const importer = registerShipyardMaintenanceImporter(knowledge, {
  readWindow: async () => ({
    watermark: 'fixture-revision-one',
    entries: [
      {
        address: 'feature:curator-authority',
        name: 'Curator authority',
        revision: 'fixture-revision-one',
        text: expected,
        citation: 'https://github.com/mastra-ai/mastra/pull/22850',
      },
    ],
  }),
  verify: async entry => entry.text === expected && entry.revision === 'fixture-revision-one',
});
const inspect = async () => {
  const internal = await knowledge.listRecordsBySource({
    source: shipyardImportBinding.source,
    scopeIds: [scopes['principal:shipyard-maintainer']!],
    limit: 100,
  });
  const publicView = await knowledge.listRecordsBySource({
    source: shipyardImportBinding.source,
    scopeIds: [scopes['principal:shipyard-public']!],
    limit: 100,
  });
  return {
    integrated: internal.records.length === 1 && internal.records[0]?.text === expected,
    internalRecordCount: internal.records.length,
    publicRecordCount: publicView.records.length,
  };
};
const model = 'openai/gpt-5-mini';
const agent = createShipyardMaintenanceAgent({
  memory: new Memory({ options: { lastMessages: 10, semanticRecall: false } }),
  inspect: async phase => {
    if (phase === 'judge') judgeReads++;
    return inspect();
  },
  repair: async () => {
    repairCalls++;
    const run = await importer.run(shipyardImportBinding);
    return { status: run.status };
  },
});
const mastra = new Mastra({ agents: { maintenance: agent }, storage });
try {
  const threadId = 'shipyard-maintenance-proof';
  assert.equal((await inspect()).integrated, false, 'Proof requires a fresh output directory with missing evidence');
  assert(
    await agent.setObjective(
      'Repair the missing verified fixture evidence; keep exactly one integrated record internal and expose none publicly.',
      {
        threadId,
        resourceId: 'shipyard-maintenance-proof',
        maxRuns: 2,
      },
    ),
  );
  await agent.generate('Inspect and repair the maintenance gap now.', {
    memory: { thread: threadId, resource: 'shipyard-maintenance-proof' },
    maxSteps: 8,
  });
  const graph = await inspect();
  const objective = await agent.getObjective({ threadId });
  assert.deepEqual(graph, { integrated: true, internalRecordCount: 1, publicRecordCount: 0 });
  assert(objective?.status === 'done');
  assert(repairCalls > 0 && judgeReads > 0);
  await writeFile(
    resolve(output, 'result.json'),
    JSON.stringify(
      {
        model,
        source: 'deterministic-fixture',
        objectiveStatus: objective.status,
        evaluations: objective.runsUsed,
        repairCalls,
        graphReads: judgeReads,
        graph,
      },
      null,
      2,
    ),
  );
} finally {
  await knowledge.shutdownImporters();
  await mastra.shutdown();
}
console.log(
  'Native goal repaired a missing verified record; graph-state judge accepted one internal record and zero public records.',
);
console.log('PROOF: GREEN — real-provider native Shipyard maintenance goal passed');
