import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { InMemoryStore } from '../../../../storage/mock';
import { Knowledge } from '../../../index';
import { hashKnowledgeDescription } from '../../compiler';
import type { KnowledgeReconcileGoalState } from '../../reconcile-goal';

const outputFlag = process.argv.indexOf('--out');
if (outputFlag === -1 || !process.argv[outputFlag + 1])
  throw new Error('Usage: compiler-reconcile.ts --out <result.json>');
const output = resolve(process.argv[outputFlag + 1]!);
const storage = new InMemoryStore({ id: 'compiler-proof' });
const description = 'Create an organization root with shared and internal child scopes.';
const injectedFailure = 'injected compiler process interruption';
const hash = hashKnowledgeDescription({ description, level: 'instance' });
const threadState = await storage.getStore('threadState');
await threadState!.setState({
  threadId: 'knowledge:proof-instance',
  type: `description-plan:${hash}`,
  value: {
    version: 1,
    attempts: 1,
    checkpoint: { completedDeclarations: 1 },
    lastError: injectedFailure,
  },
});

let resumedFromCheckpoint: unknown;
const resumed = new Knowledge({
  id: 'proof-instance',
  storage,
  description,
  compiler: {
    compile: async (_input, context) => {
      resumedFromCheckpoint = context.checkpoint;
      return {
        scopes: [
          { address: 'org:shipyard', name: 'Shipyard' },
          { address: 'org:shipyard:shared', name: 'Shared', parentAddresses: ['org:shipyard'] },
          { address: 'org:shipyard:internal', name: 'Internal', parentAddresses: ['org:shipyard'] },
        ],
      };
    },
  },
});
await resumed.reconcile();

const goal = await threadState!.getState<KnowledgeReconcileGoalState>({
  threadId: 'knowledge:proof-instance',
  type: `reconcile-goal:instance:${hash}`,
});
if (!goal?.judgePassed) throw new Error('Graph-state judge did not accept the compiled plan');

const firstTemplate = new Knowledge({
  id: 'template-proof',
  storage,
  compiler: {
    compile: async () => ({
      scopes: [{ address: '$scope:decisions', name: 'Decisions', parentAddresses: ['$scope'] }],
    }),
  },
  scopes: { 'project:$projectId': { description: 'New projects start with decisions.' } },
});
await firstTemplate.materializeScope({
  address: 'project:one',
  contextualScopeAddress: 'project:one',
  parameters: { projectId: 'one' },
});

const changedTemplate = new Knowledge({
  id: 'template-proof',
  storage,
  compiler: {
    compile: async () => ({
      scopes: [{ address: '$scope:docs', name: 'Docs', parentAddresses: ['$scope'] }],
    }),
  },
  scopes: { 'project:$projectId': { description: 'New projects start with docs.' } },
});
await changedTemplate.materializeScope({
  address: 'project:one',
  contextualScopeAddress: 'project:one',
  parameters: { projectId: 'one' },
});
await changedTemplate.materializeScope({
  address: 'project:two',
  contextualScopeAddress: 'project:two',
  parameters: { projectId: 'two' },
});
const nonRetrofit = {
  originalChildPreserved: Boolean(await changedTemplate.resolveScopeAddress('project:one:decisions')),
  changedChildAbsentFromExistingScope: !(await changedTemplate.resolveScopeAddress('project:one:docs')),
  changedChildPresentInNewScope: Boolean(await changedTemplate.resolveScopeAddress('project:two:docs')),
};
if (Object.values(nonRetrofit).some(value => !value)) throw new Error('Scope-type template snapshot semantics failed');

const proof = {
  status: 'green',
  compiledPlan: goal.plan,
  checkpointProgression: goal.progression,
  injectedFailure,
  resumedFromCheckpoint,
  graphStateJudge: { passed: goal.judgePassed },
  nonRetrofit,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
console.log('PROOF: GREEN — description compilation resumed and graph-state reconciliation passed');
