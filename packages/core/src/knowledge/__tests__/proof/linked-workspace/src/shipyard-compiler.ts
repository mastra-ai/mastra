import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Agent } from '@mastra/core/agent';
import { Knowledge, hashKnowledgeDescription } from '@mastra/core/knowledge';
import type { KnowledgeDescriptionCompilerInput, KnowledgeReconcileGoalState } from '@mastra/core/knowledge';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { shipyardDescription } from './shipyard-description';

const phase = process.argv[process.argv.indexOf('--phase') + 1];
const outIndex = process.argv.indexOf('--out');
assert(phase === 'seed' || phase === 'resume', '--phase seed|resume is required');
assert(outIndex >= 0 && process.argv[outIndex + 1], '--out <directory> is required');
assert(phase === 'resume' || process.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required for compilation');
const output = resolve(process.argv[outIndex + 1]!);
if (phase === 'seed') await mkdir(output);
const storage = new LibSQLStore({ id: 'shipyard-compiler-proof', url: `file:${join(output, 'compiler.db')}` });
const schema = z.object({
  scopes: z
    .array(
      z.object({
        address: z.string(),
        name: z.string(),
        kind: z.string(),
        parentAddresses: z.array(z.string()),
        grants: z.array(
          z.union([
            z.object({
              scopeRefAddress: z.string(),
              role: z.enum(['owner', 'edit', 'append', 'readonly']),
              canSuggest: z.boolean(),
            }),
            z.object({ scopeRefAddress: z.string(), role: z.literal('mirror') }),
          ]),
        ),
      }),
    )
    .min(7)
    .max(30),
});
const hash = hashKnowledgeDescription({ description: shipyardDescription, level: 'instance' });
let compilerCalls = 0;
let applyCalls = 0;
try {
  const domain = await storage.getStore('knowledge');
  assert(domain);
  const apply = domain.reconcileStructure.bind(domain);
  if (phase === 'seed') {
    domain.reconcileStructure = async plan => {
      applyCalls++;
      if (applyCalls === 1) throw new Error('injected pre-apply interruption');
      return apply(plan);
    };
  }
  const knowledge = new Knowledge({
    id: 'mastra',
    storage,
    description: shipyardDescription,
    compiler: {
      compile: async (input: KnowledgeDescriptionCompilerInput) => {
        compilerCalls++;
        assert.equal(phase, 'seed', 'restart must reuse the durable compiled plan without a provider call');
        assert.equal(input.description, shipyardDescription);
        const agent = new Agent({
          id: 'shipyard-description-compiler',
          name: 'Shipyard description compiler',
          model: 'openai/gpt-5-mini',
          instructions: `Compile the supplied full Knowledge description into a finite initial scope plan, not records.
Use canonical scope-node membership: parentAddresses describe containment, never infer it from names.
Grant declarations belong to the target scope, scopeRefAddress names a host-vouched principal scope.
Any local grant declaration stops ancestor-grant inheritance on that branch, including when none of
those local grants match the current principal. Repeat required principal grants on each such scope.
A mirror grant points from a companion to a content scope, not to a principal identity. It has no
canSuggest field. Never use mirror as a replacement for concrete principal grant roles.
Declare team:mastra, principal:public, and principal:github-importer as independent identity scopes.
For this host, principal:github-importer is the merged-PR import agent as well as the GitHub artifact
importer. Explicitly grant it append/edit/owner on each public feature scope and the issue/PR collections.
The host binds public visitors to principal:public and teammates to team:mastra, never to content scopes.
Use addresses subject:mastra for the product/company root, subject:mastra:features and subject:mastra:areas
for its collections, repo:mastra for the repository, repo:mastra:issues and repo:mastra:prs for its collections.
Use distinct display names where scopes share parents. Public means a readonly grant to principal:public;
private scopes must declare team-only authority to prevent inheritance of public access.
Only importer/governed authorities write public source/feature collections; teammates may suggest there.
For team:mastra on subject:mastra, its features collection and public feature scopes, use role readonly
with canSuggest true, NOT append/edit/owner. Areas and internal companions allow team edit/owner.
Instantiate the explicitly illustrated memory feature at feature:memory (name Memory), beneath
subject:mastra:features, with companions feature:memory:internal and feature:memory:uncurated
both directly beneath feature:memory.
Do not invent individual issue/PR numbers or create literal parameterized work/thread scopes: those require
later host materialization. Do not create records, aliases, legacy types or grants based on user IDs.
Compile the structure and permissions stated in the description; do not claim enforcement of provenance,
capture routing, promotion or future-template policies merely by creating these scopes.`,
        });
        const response = await agent.generate(input.description, { structuredOutput: { schema } });
        return schema.parse(response.object);
      },
    },
  });
  await knowledge.reconcile();
  const threadState = await storage.getStore('threadState');
  assert(threadState);
  const goal = await threadState.getState<KnowledgeReconcileGoalState>({
    threadId: 'knowledge:mastra',
    type: `reconcile-goal:instance:${hash}`,
  });
  assert(goal?.judgePassed && goal.checkpoint === 'complete' && goal.result);
  const compilation = await threadState.getState<Pick<KnowledgeReconcileGoalState, 'plan' | 'attempts'>>({
    threadId: 'knowledge:mastra',
    type: `description-plan:${hash}`,
  });
  assert(compilation?.plan && compilation.attempts >= 1 && compilation.attempts <= 2);
  assert.deepEqual(compilation.plan, goal.plan);
  assert.equal(goal.attempts, 2, 'the persisted goal must include its recovered apply failure');
  assert.deepEqual(goal.progression.slice(-3), ['applied', 'judging', 'complete']);
  const ids = goal.result.scopes;
  for (const address of [
    'team:mastra',
    'principal:public',
    'principal:github-importer',
    'subject:mastra',
    'subject:mastra:features',
    'subject:mastra:areas',
    'repo:mastra',
    'repo:mastra:issues',
    'repo:mastra:prs',
  ])
    assert(ids[address], address);
  for (const [address, parents] of Object.entries({
    'subject:mastra': [],
    'repo:mastra': [],
    'subject:mastra:features': ['subject:mastra'],
    'subject:mastra:areas': ['subject:mastra'],
    'repo:mastra:issues': ['repo:mastra'],
    'repo:mastra:prs': ['repo:mastra'],
  })) {
    assert.deepEqual(goal.plan.scopes.find(scope => scope.address === address)?.parentAddresses, parents);
  }
  const memory = goal.plan.scopes.find(
    scope => scope.address === 'feature:memory' && scope.parentAddresses?.includes('subject:mastra:features'),
  );
  assert(memory, 'the description must compile the illustrated memory feature');
  const memoryAddress = memory.address;
  for (const suffix of [':internal', ':uncurated']) {
    assert.deepEqual(
      goal.plan.scopes.find(scope => scope.address === `${memoryAddress}${suffix}`)?.parentAddresses,
      [memoryAddress],
      `memory companion missing or misplaced: ${suffix}`,
    );
  }
  const publicScopeIds = [ids['principal:public']!];
  const teamScopeIds = [ids['team:mastra']!];
  for (const address of [
    'subject:mastra',
    'subject:mastra:features',
    'repo:mastra',
    'repo:mastra:issues',
    'repo:mastra:prs',
  ]) {
    assert(
      await knowledge.getScope({ id: ids[address]!, scopeIds: publicScopeIds }),
      `public scope missing: ${address}`,
    );
  }
  const publicFrontier = await knowledge.evaluateAccess(publicScopeIds);
  const teamFrontier = await knowledge.evaluateAccess(teamScopeIds);
  const importerFrontier = await knowledge.evaluateAccess([ids['principal:github-importer']!]);
  for (const address of [
    'subject:mastra',
    'subject:mastra:features',
    memory.address,
    'repo:mastra',
    'repo:mastra:issues',
    'repo:mastra:prs',
  ]) {
    const publicCapabilities = publicFrontier.scopes[ids[address]!];
    assert(
      publicCapabilities?.read &&
        !publicCapabilities.suggest &&
        !publicCapabilities.append &&
        !publicCapabilities.edit &&
        !publicCapabilities.manageAccess,
      `public access must remain readonly: ${address}`,
    );
    const teamCapabilities = teamFrontier.scopes[ids[address]!];
    assert(
      !teamCapabilities?.append && !teamCapabilities?.edit,
      `team must not directly write source/feature scopes: ${address}`,
    );
  }
  for (const address of ['subject:mastra:features', memory.address, 'repo:mastra:issues', 'repo:mastra:prs']) {
    assert(importerFrontier.scopes[ids[address]!]?.append, `importer write authority missing: ${address}`);
  }
  for (const address of ['subject:mastra', 'subject:mastra:features', memory.address]) {
    assert(teamFrontier.scopes[ids[address]!]?.suggest, `team suggestion authority missing: ${address}`);
  }
  const internal = goal.plan.scopes.filter(scope => scope.address.endsWith(':internal'));
  assert(internal.length > 0, 'description must compile private companion scopes');
  const prior = phase === 'resume' ? JSON.parse(await readFile(join(output, 'seed.json'), 'utf8')) : undefined;
  const evidenceSchema = z.record(z.string(), z.object({ nodeId: z.string(), recordId: z.string() }));
  const evidence = prior ? evidenceSchema.parse(prior.evidence) : {};
  for (const address of ['subject:mastra:areas', ...internal.map(scope => scope.address)]) {
    const scopeId = ids[address]!;
    assert(!publicFrontier.scopes[scopeId]?.read, `public authority leaked into ${address}`);
    assert(teamFrontier.scopes[scopeId]?.append, `team write authority missing for ${address}`);
    if (phase === 'seed') {
      const node = await knowledge.createNode({
        name: `Private compiler evidence: ${address}`,
        scopeIds: [scopeId],
        vouchedScopeIds: teamScopeIds,
      });
      const record = await knowledge.createRecord({
        node: node.id,
        text: 'Private compiler proof evidence',
        source: 'shipyard-description-proof',
        scopeIds: [scopeId],
        contextScopeId: scopeId,
        vouchedScopeIds: teamScopeIds,
      });
      evidence[address] = { nodeId: node.id, recordId: record.id };
    }
    const item = evidence[address];
    assert(item, `missing persisted evidence for ${address}`);
    assert(await knowledge.getNode({ id: item.nodeId, scopeIds: teamScopeIds }));
    assert(await knowledge.getRecord({ id: item.recordId, scopeIds: teamScopeIds }));
    assert.equal(await knowledge.getNode({ id: item.nodeId, scopeIds: publicScopeIds }), null);
    assert.equal(await knowledge.getRecord({ id: item.recordId, scopeIds: publicScopeIds }), null);
  }
  const summary = {
    descriptionHash: hash,
    initialCompilerAttempts: compilation.attempts,
    planHash: createHash('sha256').update(JSON.stringify(goal.plan)).digest('hex'),
    scopeIds: ids,
    evidence,
    teammateFeatureWritesDenied: true,
    progression: goal.progression,
    publicPrivateSeparation: true,
    recoveredApplyFailure: true,
  };
  if (phase === 'seed') {
    assert.equal(compilerCalls, compilation.attempts);
    assert.equal(applyCalls, 2);
    await writeFile(join(output, 'seed.json'), JSON.stringify(summary, null, 2));
  } else {
    assert.equal(compilerCalls, 0);
    assert.deepEqual(summary, JSON.parse(await readFile(join(output, 'seed.json'), 'utf8')));
    await writeFile(
      join(output, 'result.json'),
      JSON.stringify(
        {
          ...summary,
          freshProcessRestart: true,
          restartCompilerCalls: compilerCalls,
          limitations: [
            'host-supplied provider compiler',
            'private scope labels may be visible through public parent membership; private contents remain denied',
            'initial concrete structure only; runtime capture and promotion have separate proofs',
          ],
        },
        null,
        2,
      ),
    );
  }
  console.log(
    `PROOF: GREEN — full Shipyard description ${phase}: durable reconciliation and public/private separation`,
  );
} finally {
  await storage.close();
}
