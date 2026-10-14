// Regenerates snapshot-w1-20261009054256-{used,idle}.db.gz with the published snapshot itself.
// Run from an empty directory after:
//   npm i @mastra/core@0.0.0-knowledge-w1-20261009054256 @mastra/libsql@0.0.0-knowledge-w1-20261009054256 zod@^3.25.0
// then: node generate-snapshot-w1-dbs.mjs used && node generate-snapshot-w1-dbs.mjs idle && gzip -9 -n *.db
import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';

const mode = process.argv[2];
if (mode !== 'used' && mode !== 'idle') throw new Error('usage: generate-snapshot-w1-dbs.mjs used|idle');

const storage = new LibSQLStore({ id: 'w1', url: `file:snapshot-w1-20261009054256-${mode}.db` });
await storage.init();
const knowledge = new Knowledge({ id: 'knowledge', storage });
await (await knowledge.getStorage()).init?.();

if (mode === 'used') {
  const scope = ['org:acme'];
  const node = await knowledge.createNode({ name: 'Acme Roadmap', kind: 'project', scope });
  await knowledge.appendKnowledge({
    node: { id: node.id },
    text: 'Launch is in Q4',
    scope,
    sourceThreadId: 't1',
    resolutionScope: scope,
    defaultScope: scope,
  });
}
