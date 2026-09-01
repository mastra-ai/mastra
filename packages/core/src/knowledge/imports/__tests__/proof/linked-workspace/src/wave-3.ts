import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Knowledge } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';

const adapter = process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql';
const outArg = process.argv.indexOf('--out');
const outputDirectory = resolve(outArg >= 0 ? process.argv[outArg + 1]! : `./proof-${adapter}`);
const dbPath = resolve(outputDirectory, 'wave-3.db');
const schemaName = `knowledge_wave_3_${randomUUID().replaceAll('-', '')}`;
const workerPath = resolve(dirname(fileURLToPath(import.meta.url)), 'wave-3-worker.ts');

function invariant(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function createStore(id: string) {
  return adapter === 'pg'
    ? new PostgresStore({
        id,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5434,
        database: process.env.POSTGRES_DB || 'postgres',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        schemaName,
      })
    : new LibSQLStore({ id, url: `file:${dbPath}` });
}

async function readInWorker(config: {
  nodeId: string;
  principalScopeId: string;
}): Promise<{ read: () => Promise<boolean>; close: () => Promise<void> }> {
  const worker = fork(workerPath, [JSON.stringify({ adapter, dbPath, schemaName, ...config })], {
    execArgv: ['--import', 'tsx'],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  await new Promise<void>((resolveReady, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(new Error(`Wave 3 proof worker exited before ready (code ${code}, signal ${signal})`));
    };
    const onMessage = (message: unknown) => {
      if ((message as { type?: string }).type !== 'ready') return;
      cleanup();
      resolveReady();
    };
    const cleanup = () => {
      worker.off('error', onError);
      worker.off('exit', onExit);
      worker.off('message', onMessage);
    };
    worker.once('error', onError);
    worker.once('exit', onExit);
    worker.on('message', onMessage);
  });
  return {
    read: () =>
      new Promise<boolean>((resolveRead, reject) => {
        const cleanup = () => {
          worker.off('error', onError);
          worker.off('exit', onExit);
          worker.off('message', onMessage);
        };
        const onError = (error: Error) => {
          cleanup();
          reject(error);
        };
        const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
          cleanup();
          reject(new Error(`Wave 3 proof worker exited during read (code ${code}, signal ${signal})`));
        };
        const onMessage = (message: unknown) => {
          const result = message as { type?: string; visible?: boolean; message?: string };
          if (result.type === 'result') {
            cleanup();
            resolveRead(result.visible === true);
          } else if (result.type === 'error') {
            cleanup();
            reject(new Error(result.message));
          }
        };
        worker.once('error', onError);
        worker.once('exit', onExit);
        worker.on('message', onMessage);
        worker.send('read');
      }),
    close: async () => {
      worker.kill();
      await new Promise<void>(resolveExit => worker.once('exit', () => resolveExit()));
    },
  };
}

await mkdir(outputDirectory, { recursive: true });
await rm(dbPath, { force: true });
const storage = createStore('wave-3-proof-main');
const knowledge = new Knowledge({ id: 'wave-3-proof-main', storage });
const store = await knowledge.getStorageInternal();

const initialScopes = [
  { address: 'principal:reader', name: 'Reader' },
  { address: 'principal:suggester', name: 'Suggester' },
  { address: 'principal:owner', name: 'Owner' },
  { address: 'principal:other', name: 'Other' },
  {
    address: 'scope:project',
    name: 'Project',
    grants: [
      { scopeRefAddress: 'principal:reader', role: 'readonly' as const },
      { scopeRefAddress: 'principal:suggester', role: 'readonly' as const, canSuggest: true },
      { scopeRefAddress: 'principal:owner', role: 'owner' as const },
    ],
  },
  {
    address: 'scope:private',
    name: 'Private',
    grants: [{ scopeRefAddress: 'principal:other', role: 'owner' as const }],
  },
  {
    address: 'scope:cycle-a',
    name: 'Cycle A',
    grants: [
      { scopeRefAddress: 'principal:reader', role: 'readonly' as const },
      { scopeRefAddress: 'scope:cycle-b', role: 'edit' as const },
    ],
  },
  {
    address: 'scope:cycle-b',
    name: 'Cycle B',
    grants: [{ scopeRefAddress: 'scope:cycle-a', role: 'readonly' as const }],
  },
  {
    address: 'scope:mirror',
    name: 'Mirror',
    grants: [{ scopeRefAddress: 'scope:cycle-b', role: 'mirror' as const }],
  },
] as const;
const structure = await store.reconcileStructure({ scopes: initialScopes });
const ids = structure.scopes;
const reader = ids['principal:reader']!;
const suggester = ids['principal:suggester']!;
const owner = ids['principal:owner']!;
const project = ids['scope:project']!;
const privateScope = ids['scope:private']!;
const cycleB = ids['scope:cycle-b']!;
const mirror = ids['scope:mirror']!;

const visibleNode = await store.createNode({ name: 'Visible handbook', scopeIds: [project] });
const hiddenNode = await store.createNode({ name: 'Private strategy', scopeIds: [privateScope] });
const multiParentNode = await store.createNode({ name: 'Shared boundary', scopeIds: [project, privateScope] });
const cycleNode = await store.createNode({ name: 'Cycle-safe node', scopeIds: [cycleB] });
const mirrorNode = await store.createNode({ name: 'Mirror-safe node', scopeIds: [mirror] });
const visibleRecord = await store.createRecord({
  node: visibleNode,
  text: 'Visible policy',
  scopeIds: [project],
  contextScopeId: project,
});
await store.createRecord({
  node: visibleNode,
  text: 'Private stamp',
  scopeIds: [privateScope],
  contextScopeId: privateScope,
});
await store.createRecord({
  node: visibleNode,
  text: 'Hidden mention [[Private strategy]]',
  scopeIds: [project],
  resolutionScopeIds: [project, privateScope],
  contextScopeId: project,
});

const beforeHiddenInsert = await knowledge.listNodes({ scopeIds: [reader], namePrefix: '', limit: 100 });
const beforeRecords = await knowledge.listRecords({ node: visibleNode, scopeIds: [reader], limit: 1 });
for (let index = 0; index < 25; index += 1) {
  await store.createNode({ name: `Hidden ${index.toString().padStart(2, '0')}`, scopeIds: [privateScope] });
}
const afterHiddenInsert = await knowledge.listNodes({ scopeIds: [reader], namePrefix: '', limit: 100 });
const afterRecords = await knowledge.listRecords({ node: visibleNode, scopeIds: [reader], limit: 1 });
invariant(
  JSON.stringify(afterHiddenInsert) === JSON.stringify(beforeHiddenInsert),
  'Hidden nodes changed visible result shape',
);
invariant(JSON.stringify(afterRecords) === JSON.stringify(beforeRecords), 'Hidden records changed visible pagination');
invariant(
  afterRecords.records.length === 1 && afterRecords.records[0]?.id === visibleRecord.id,
  'Visible record was displaced',
);
invariant((await knowledge.getNode({ id: hiddenNode.id, scopeIds: [reader] })) === null, 'Hidden node leaked');
invariant(
  (await knowledge.getNode({ id: multiParentNode.id, scopeIds: [reader] }))?.id === multiParentNode.id,
  'Any-visible membership failed',
);
invariant(
  (await knowledge.getNode({ id: cycleNode.id, scopeIds: [reader] }))?.id === cycleNode.id,
  'Cycle closure failed',
);
invariant(
  (await knowledge.getNode({ id: mirrorNode.id, scopeIds: [reader] }))?.id === mirrorNode.id,
  'Mirror closure failed',
);

const proposalApprovedAfterRevocation = await knowledge.proposeNodeUpdate({
  mutation: { id: visibleNode.id, version: visibleNode.version, name: 'Approved after proposer revocation' },
  proposerContextScopeId: suggester,
  vouchedScopeIds: [suggester],
});
const proposalForConflict = await knowledge.proposeNodeUpdate({
  mutation: { id: multiParentNode.id, version: multiParentNode.version, name: 'Stale proposed title' },
  proposerContextScopeId: suggester,
  vouchedScopeIds: [suggester],
});
await store.reconcileStructure({
  scopes: [
    {
      address: 'scope:project',
      name: 'Project',
      grants: [
        { scopeRefAddress: 'principal:reader', role: 'readonly' },
        { scopeRefAddress: 'principal:owner', role: 'owner' },
      ],
    },
  ],
});
invariant(
  (await knowledge.listProposals({ vouchedScopeIds: [suggester] })).proposals.length === 0,
  'Revoked proposer retained proposal visibility',
);
await knowledge.approveProposal({
  id: proposalApprovedAfterRevocation.id,
  reviewerContextScopeId: owner,
  vouchedScopeIds: [owner],
});
await knowledge.updateNode({
  id: multiParentNode.id,
  version: multiParentNode.version,
  name: 'Concurrent title',
  vouchedScopeIds: [owner],
});
let conflictObserved = false;
try {
  await knowledge.approveProposal({
    id: proposalForConflict.id,
    reviewerContextScopeId: owner,
    vouchedScopeIds: [owner],
  });
} catch {
  conflictObserved = true;
}
invariant(conflictObserved, 'Stale proposal approval did not conflict');
const replacement = await knowledge.reReviewProposal({
  id: proposalForConflict.id,
  reviewerContextScopeId: owner,
  vouchedScopeIds: [owner],
});
await knowledge.rejectProposal({
  id: replacement.id,
  reviewerContextScopeId: owner,
  vouchedScopeIds: [owner],
  reason: 'Fresh source contradicts the proposal',
});

const worker = await readInWorker({ nodeId: visibleNode.id, principalScopeId: reader });
const warmVisible = await worker.read();
await store.reconcileStructure({
  scopes: [
    {
      address: 'scope:project',
      name: 'Project',
      grants: [{ scopeRefAddress: 'principal:owner', role: 'owner' }],
    },
  ],
});
const visibleAfterRevocation = await worker.read();
await worker.close();
invariant(warmVisible, 'Second process could not warm its frontier');
invariant(!visibleAfterRevocation, 'Second process served revoked access from a warm cache');

const result = {
  adapter,
  hiddenDataNoninterference: true,
  inaccessibleEqualsAbsent:
    (await knowledge.getNode({ id: hiddenNode.id, scopeIds: [reader] })) ===
    (await knowledge.getNode({ id: randomUUID(), scopeIds: [reader] })),
  cycleSafe: true,
  mirrorSafe: true,
  multiParentAnyVisible: true,
  proposalApprovedAfterProposerRevocation: true,
  staleProposalConflicted: conflictObserved,
  replacementRejected: true,
  warmCacheVisibleBeforeRevocation: warmVisible,
  warmCacheVisibleAfterRevocation: visibleAfterRevocation,
};
invariant(result.inaccessibleEqualsAbsent, 'Hidden and absent point lookups diverged');
await storage.close();
await writeFile(resolve(outputDirectory, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
console.log(`PROOF: GREEN — Wave 3 noninterference passed on ${adapter}`);
