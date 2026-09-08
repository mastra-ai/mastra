import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { knowledgeImporterBindingKey } from '@mastra/core/storage';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createShipyardGitHubSource } from './shipyard-github-source.js';
import { shipyardImportBinding } from './shipyard-importer.js';
import { createShipyardMaintenanceRuntime } from './shipyard-maintenance.js';
import { createShipyardKnowledge } from './shipyard.js';

const directory = await mkdtemp(join(tmpdir(), 'shipyard-wiring-'));
const storage = new LibSQLStore({
  id: 'shipyard-wiring-proof',
  url: process.argv.includes('--memory') ? ':memory:' : `file:${join(directory, 'knowledge.db')}`,
});
const { knowledge, scopes } = await createShipyardKnowledge(storage);
let body = 'Verified source revision one';
let available = true;
let checkpointed = false;
let empty = false;
const source = createShipyardGitHubSource({
  repository: 'mastra-ai/mastra',
  since: '2026-09-01T00:00:00Z',
  token: 'fixture-token',
  fetch: async url => {
    if (!available) return new Response('Unavailable', { status: 503 });
    if (String(url).includes('/search/issues?')) {
      if (checkpointed && decodeURIComponent(String(url)).includes('2026-09-01')) {
        return Response.json({ total_count: 21, incomplete_results: false, items: [] });
      }
      if (empty) return Response.json({ total_count: 0, incomplete_results: false, items: [] });
      return Response.json({ total_count: 1, incomplete_results: false, items: [{ number: 12 }] });
    }
    assert.equal(String(url), 'https://api.github.com/repos/mastra-ai/mastra/pulls/12');
    return Response.json({
      number: 12,
      title: 'Curator authority',
      body,
      merged_at: '2026-09-02T00:00:00Z',
      merge_commit_sha: 'immutable-fixture-sha',
    });
  },
});
const runtime = createShipyardMaintenanceRuntime({
  knowledge,
  scopes,
  source,
  memory: new Memory({ options: { semanticRecall: false } }),
});
try {
  assert.equal((await runtime.inspect()).integrated, false);
  assert.equal((await runtime.repair()).status, 'succeeded');
  assert.deepEqual(await runtime.inspect(), { integrated: true, internalRecordCount: 1, publicRecordCount: 0 });
  checkpointed = true;
  assert.equal(
    (await runtime.inspect()).integrated,
    true,
    'Inspection must use the durable checkpoint, not rescan historical overflow',
  );
  const authority = [scopes['principal:shipyard-maintainer']!];
  const records = await knowledge.listRecordsBySource({
    source: shipyardImportBinding.source,
    scopeIds: authority,
    limit: 10,
  });
  await knowledge.createRecord({
    node: records.records[0]!.nodeId,
    text: 'Extra stale record',
    source: shipyardImportBinding.source,
    scopeIds: [scopes[shipyardImportBinding.scope]!],
    vouchedScopeIds: authority,
  });
  assert.equal(
    (await runtime.inspect()).integrated,
    false,
    'A matching record plus stale evidence must fail completion',
  );
  assert.equal((await runtime.repair()).status, 'succeeded');
  empty = true;
  assert.deepEqual(await runtime.inspect(), { integrated: true, internalRecordCount: 0, publicRecordCount: 0 });
  empty = false;
  body = 'Verified source revision two';
  assert.equal((await runtime.inspect()).integrated, false);
  const domain = await storage.getStore('knowledge');
  assert(domain);
  const finalize = domain.finalizeImportRun.bind(domain);
  domain.finalizeImportRun = async input => {
    if (input.status === 'succeeded') throw new Error('Injected crash before atomic checkpoint commit');
    return finalize(input);
  };
  assert.equal((await runtime.repair()).status, 'failed');
  assert.equal((await runtime.inspect()).integrated, false, 'Uncheckpointed repaired graph must not satisfy the judge');
  domain.finalizeImportRun = finalize;
  assert.equal((await runtime.repair()).status, 'succeeded');
  assert.deepEqual(await runtime.inspect(), { integrated: true, internalRecordCount: 1, publicRecordCount: 0 });
  const stateQuery = {
    importerId: 'shipyard-maintenance',
    binding: knowledgeImporterBindingKey(shipyardImportBinding),
    key: 'checkpoint',
    scopeIds: authority,
  };
  const checkpointBeforeFailure = await knowledge.getImportState(stateQuery);
  available = false;
  await assert.rejects(runtime.inspect(), /GitHub source request failed \(503\)/);
  assert.equal((await runtime.repair()).status, 'failed');
  assert.deepEqual(await knowledge.getImportState(stateQuery), checkpointBeforeFailure);
  available = true;
  assert.deepEqual(await runtime.inspect(), { integrated: true, internalRecordCount: 1, publicRecordCount: 0 });
  console.log(
    'PROOF: GREEN — executable Shipyard source/import/maintenance wiring; source changes integrated once, failures preserve graph, public evidence absent',
  );
} finally {
  await knowledge.shutdownImporters();
  await storage.close();
  await rm(directory, { recursive: true, force: true });
}
