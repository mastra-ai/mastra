import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { registerShipyardMaintenanceImporter, shipyardImportBinding } from './shipyard-importer.js';
import { createShipyardKnowledge } from './shipyard.js';

const outputIndex = process.argv.indexOf('--out');
const phaseIndex = process.argv.indexOf('--phase');
assert(outputIndex >= 0 && process.argv[outputIndex + 1], '--out is required');
const output = resolve(process.argv[outputIndex + 1]!);
const phase = process.argv[phaseIndex + 1];
assert(phase === 'seed' || phase === 'resume', '--phase seed|resume is required');
await mkdir(output, { recursive: true });
const storage = new LibSQLStore({ id: 'shipyard-proof', url: `file:${resolve(output, 'shipyard.db')}` });
const { knowledge, scopes } = await createShipyardKnowledge(storage);
const query = {
  source: shipyardImportBinding.source,
  scopeIds: [scopes['principal:shipyard-maintainer']!],
  limit: 100,
};
let revision = 'one';
let verified = true;
const watermarks: (string | undefined)[] = [];
const importer = registerShipyardMaintenanceImporter(knowledge, {
  readWindow: async watermark => {
    watermarks.push(watermark);
    return {
      watermark: revision,
      entries: [
        {
          address: 'feature:curation',
          name: 'Curation evidence',
          revision,
          text: `Fixture verified curation revision ${revision}`,
          citation: 'https://github.com/mastra-ai/mastra/pull/22850',
        },
      ],
    };
  },
  verify: async () => verified,
});
assert.equal((await importer.run(shipyardImportBinding)).status, 'succeeded');
const baseline = (await knowledge.listRecordsBySource(query)).records;
assert.equal(baseline.length, 1);
if (phase === 'seed') {
  assert.equal(watermarks[0], undefined);
  await writeFile(
    resolve(output, 'seed.json'),
    JSON.stringify({ nodeId: baseline[0]!.nodeId, recordId: baseline[0]!.id }),
  );
  console.log('Seed: integrated one verified fixture revision into durable LibSQL storage.');
} else {
  assert.equal(watermarks[0], 'one', 'Fresh process did not resume durable watermark');
  revision = 'two';
  verified = false;
  assert.equal((await importer.run(shipyardImportBinding)).status, 'failed');
  assert.deepEqual((await knowledge.listRecordsBySource(query)).records, baseline);
  verified = true;
  assert.equal((await importer.run(shipyardImportBinding)).status, 'succeeded');
  const current = (await knowledge.listRecordsBySource(query)).records;
  assert.equal(current.length, 1);
  assert.equal(current[0]!.nodeId, baseline[0]!.nodeId);
  assert.equal(current[0]!.text, 'Fixture verified curation revision two');
  assert.deepEqual(watermarks, ['one', 'one', 'one']);
  const publicView = await knowledge.listRecordsBySource({
    ...query,
    scopeIds: [scopes['principal:shipyard-public']!],
  });
  assert.equal(publicView.records.length, 0);
  const result = {
    surface: 'linked-built-packages',
    adapter: 'libsql',
    source: 'deterministic-fixture',
    freshProcessWatermark: true,
    replayWithoutDuplicates: true,
    failedVerificationPreservesGraph: true,
    forwardIntegrationPreservesNode: true,
    publicPrivateSeparation: true,
    nodeId: current[0]!.nodeId,
    recordId: current[0]!.id,
  };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(
    'Resume: durable watermark restored; replay stayed singular; unverified revision rejected; verified update integrated; public view stayed empty.',
  );
  console.log('PROOF: GREEN — Shipyard deterministic durable maintenance passed');
}
await storage.close();
