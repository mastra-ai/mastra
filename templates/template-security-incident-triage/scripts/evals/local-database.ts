import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import { migrateOperationalStore } from '../../src/db/migrate.js';
import { loadRunbooks } from '../../src/mastra/knowledge/loader.js';
import { DeterministicRunbookEmbedder } from '../../src/mastra/knowledge/embeddings.js';
import { LibSqlRunbookVectorStore } from '../../src/mastra/knowledge/vector-store.js';
import { indexRunbook } from '../../src/mastra/knowledge/indexer.js';

export async function prepareLocalWorkflowDatabase(directory: string, caseId: string) {
  if (!/^[a-z]+-(?:approved|rejected|expired|benign)$/u.test(caseId)) throw new Error('LOCAL_CASE_ID_INVALID');
  const path = resolve(directory, `${caseId}.db`);
  await (await open(path, 'wx')).close();
  const url = pathToFileURL(path).href;
  const openStore = () => createLibSqlOperationalStore({ url });
  const store = openStore();
  const vector = new LibSqlRunbookVectorStore({ url });
  try {
    const runbooks = await loadRunbooks(resolve(process.cwd(), 'runbooks'));
    await migrateOperationalStore(store);
    for (const [index, runbook] of runbooks.entries())
      await indexRunbook(store, vector, new DeterministicRunbookEmbedder(), runbook, {
        generationId: `eval-generation-${index}`,
        now: '2026-08-28T09:59:00.000Z',
      });
    return { url, openStore, runbooks };
  } finally {
    store.close();
    await vector.close();
  }
}
