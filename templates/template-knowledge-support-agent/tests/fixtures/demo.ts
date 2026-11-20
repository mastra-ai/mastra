import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { runtimeFixture } from './runtime.ts';
import { demoCorpus } from './demo-corpus.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { retailProfiles, exampleReviewers } from '../../src/examples/retail-pos/profiles.ts';
import { integrationProfiles, integrationReviewers } from '../../src/examples/runtime.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import type { Candidate, Proposal, ReviewInput } from '../../src/mastra/review/contracts.ts';
import type { ScriptedReply } from './model-server.ts';

const execute = promisify(execFile);
export type Fixture = Awaited<ReturnType<typeof demoFixture>>;
export type Message = { role: string; content?: string };
export interface History {
  status: string;
  records: { ref: string; state: string; observedOn: string; applicability?: string; summary: string }[];
}
export const sentinels = {
  prompt: 'F5_PRIVATE_PROMPT_NEBULA',
  credential: 'F5_AUTH_SECRET_OBSIDIAN',
  payment: '4111111111111111',
  provider: 'F5_PROVIDER_ERROR_PRIVATE_SAFFRON',
  policy: 'ESCALATE_TO_EXAMPLE_SUPERVISOR_FIRST',
};
export function messages(body: Record<string, unknown>) {
  return body.messages as Message[];
}
export function history(body: Record<string, unknown>): History {
  const item = messages(body).find(message => message.content?.startsWith('Customer history preflight'));
  assert.ok(item, 'Scoped preflight must reach the real provider');
  return JSON.parse(item.content!.slice(item.content!.indexOf('\n') + 1));
}
export function latest(body: Record<string, unknown>) {
  const list = messages(body);
  let index = list.length - 1;
  while (index >= 0 && (list[index]!.role !== 'user' || list[index]!.content?.startsWith('<pinned-knowledge'))) index--;
  return {
    question: list[index]?.content ?? '',
    tools: list.slice(index + 1).filter(message => message.role === 'tool'),
  };
}
function parsedTool(message: Message | undefined): Record<string, any> {
  assert.equal(typeof message?.content, 'string');
  return JSON.parse(message!.content!);
}
export async function json(response: Response, status = 200) {
  const text = await response.text();
  assert.equal(response.status, status, text);
  return JSON.parse(text);
}

/** A real HTTP model edge. Assertions use actual Knowledge results and current provider input. */
export async function demoFixture(example: 'retail-pos' | 'software-integration' = 'retail-pos') {
  const alternate = example === 'software-integration';
  const tenant = alternate ? 'software' : 'retailops';
  const guide = alternate ? 'docs:software#guides/request-check' : 'docs:retailops#guides/network';
  const publicUrl = alternate ? demoCorpus.sources[3] : demoCorpus.sources[0];
  const profiles = alternate ? integrationProfiles : retailProfiles;
  const reviewerProfile = alternate
    ? integrationReviewers[0]!
    : exampleReviewers.find(profile => profile.id === 'retailops-reviewer')!;
  let selected: Candidate;
  let reuse: string | undefined;
  const f = await runtimeFixture({
    example,
    syntheticKnowledge: false,
    profiles: [...profiles, { ...reviewerProfile, review: true }],
    modelScript: body => {
      const list = messages(body);
      const allTools = list.filter(message => message.role === 'tool');
      if (list.some(message => message.content?.includes('Review one confirmed customer outcome'))) {
        assert.ok(selected, 'Review scenario must select a candidate');
        if (!allTools.length)
          return { tool: { name: 'knowledge_search', arguments: { query: alternate ? 'authentication' : 'network' } } };
        const evidence = JSON.stringify(allTools);
        assert.doesNotMatch(
          evidence,
          /RETAILOPS_STORE73|FIELDRETAIL_STORE42|docs:|tenant:/u,
          'Curator receives only its customer scope',
        );
        return { content: JSON.stringify(selected) };
      }
      const { question, tools } = latest(body);
      if (question.includes('F5:provider-failure')) return { httpError: { status: 503, message: sentinels.provider } };
      const prepared = history(body);
      if (question.startsWith('Confirmed:'))
        return {
          content: 'The confirmed observation remains in this conversation until a separate reviewer approves it.',
        };
      if (question.includes('F5:policy')) {
        const pins = list
          .filter(message => message.content?.startsWith('<pinned-knowledge'))
          .map(message => message.content)
          .join('\n');
        assert.match(pins, /factory reset|credential values/u);
        return {
          content: pins.includes(sentinels.policy)
            ? `${sentinels.policy}. The required current policy blocks this unsafe change.`
            : `The required current policy blocks this unsafe change [tenant:${tenant}#policies/safe-changes].`,
        };
      }
      if (question.includes('F5:conflict')) {
        assert.equal(prepared.records.length, 2);
        assert.ok(prepared.records.some(record => record.summary.includes('recovered')));
        assert.ok(prepared.records.some(record => record.summary.includes('did not recover')));
        return {
          content: `The historical findings conflict. I cannot choose a repair from these observations. ${prepared.records.map(record => `[${record.ref}] ${record.summary}`).join(' ')} Collect the current connection type and observed result before applying either case.`,
        };
      }
      if (question.includes('F5:history')) {
        assert.equal(prepared.status, 'ready');
        assert.ok(prepared.records.length <= 3);
        assert.ok(
          prepared.records.some(record => record.state === 'open'),
          'Open issue must cross the provider boundary',
        );
        assert.ok(prepared.records.every(record => record.applicability && record.observedOn));
        return {
          content: `The open issue has no verified repair. Historical findings are limited to their stated applicability. ${prepared.records.map(record => `[${record.ref}] ${record.state}: ${record.applicability}`).join('\n')} Which connection and observations match this incident?`,
        };
      }
      if (question.includes('F5:insufficient')) {
        if (!tools.length)
          return { tool: { name: 'knowledge_search', arguments: { query: 'unobtanium zygomorphic fluxcapacitor' } } };
        assert.deepEqual(parsedTool(tools[0]).results, []);
        return {
          content:
            'Evidence is insufficient for this unsupported fault. Collect the device model and observed indicator, then escalate. No verified resolution is available.',
        };
      }
      if (question.includes('F5:foreign')) {
        const ref = question.split('READ=')[1]!.split(' ')[0]!;
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: ref, notes: true } } };
        assert.match(tools[0]!.content!, /denied|not found|not readable|scope|access/iu);
        assert.doesNotMatch(
          JSON.stringify(tools),
          /RETAILOPS_STORE73_(?:SILVER|NOTE)|FIELDRETAIL_STORE42_(?:TEAL|NOTE)/u,
        );
        return {
          content: 'Evidence is unavailable in the authorized scope. I cannot use the requested foreign record.',
        };
      }
      if (question.includes('F5:reuse')) {
        assert.ok(reuse);
        if (!tools.length)
          return {
            tool: { name: 'knowledge_search', arguments: { query: selected.title, scope: [`tenant:${tenant}`] } },
          };
        if (tools.length === 1) {
          assert.ok(
            parsedTool(tools[0]).results.some((result: any) => result.page?.ref === reuse),
            'Approved shared finding must be searchable',
          );
          return { tool: { name: 'knowledge_read', arguments: { page: reuse } } };
        }
        const page = parsedTool(tools.at(-1)).page;
        assert.match(page.body, /Public source:/u);
        assert.ok(page.body.includes(guide));
        return {
          content: `Use only when the observed conditions match. Reviewed finding [${page.ref}] cites public source [${guide}] (${publicUrl}).`,
        };
      }
      if (question.includes('F5:notes')) {
        const ref = question.split('READ=')[1]!.split(' ')[0]!;
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: ref, notes: true } } };
        const response = parsedTool(tools[0]);
        assert.ok(response.notes?.length);
        return { content: `The attributed fictional follow-up is visible [${ref}].` };
      }
      if (!tools.length)
        return {
          tool: {
            name: 'knowledge_search',
            arguments: {
              query: alternate ? '401 WWW-Authenticate' : 'Wi-Fi network adjacent device',
              scope: [`docs:${tenant}`],
            },
          },
        };
      if (tools.length === 1) {
        assert.ok(
          parsedTool(tools[0]).results.some((result: any) => result.page?.ref === guide),
          'Diagnostic citation must originate in real search results',
        );
        return { tool: { name: 'knowledge_read', arguments: { page: guide } } };
      }
      const page = parsedTool(tools.at(-1)).page;
      assert.equal(page.ref, guide);
      assert.ok(page.body.includes(publicUrl));
      if (alternate) {
        assert.match(page.body, /WWW-Authenticate/u);
        return {
          content: `A 401 alone does not prove expiration or the omitted-authentication case. Check the status and challenge scheme without credential values [${guide}] (${publicUrl}).`,
        };
      }
      assert.match(page.body, /adjacent|nearby/u);
      return {
        content: `${prepared.status === 'empty' ? 'No customer history yet. ' : ''}Compare the selected Wi-Fi network and adjacent device [${guide}] (${publicUrl}). Which connection indicator is visible, and are offline payments pending?`,
      };
    },
  });
  const copied = join(f.directory, 'datasets');
  try {
    await cp(join(process.cwd(), 'knowledge-datasets'), copied, { recursive: true });
  } catch (error) {
    await f.close().catch(() => undefined);
    throw error;
  }
  const configs = Object.fromEntries(
    Object.entries(datasets).map(([id, config]) => [
      id,
      { ...config, directory: join(copied, id === 'software-integration' ? id : 'retail-pos') },
    ]),
  );
  const reviewer = profiles.length;
  return Object.assign(f, {
    example,
    tenant,
    guide,
    publicUrl,
    reviewer,
    owner: 0,
    colleague: alternate ? 1 : 3,
    otherCustomer: alternate ? undefined : 1,
    otherTenant: alternate ? undefined : 2,
    select(value: Candidate) {
      selected = value;
    },
    reuse(reference: string) {
      reuse = reference;
    },
    async seed(id = alternate ? 'software-integration' : 'retail-pos-docs') {
      return seedDataset(configs[id]!);
    },
    async revisePolicy() {
      const path = join(copied, alternate ? 'software-integration/policy.md' : 'retail-pos/retail-policy.md');
      await writeFile(path, `${await readFile(path, 'utf8')}\nExample team policy: ${sentinels.policy}.\n`);
      return seedDataset(configs[alternate ? 'software-integration' : 'retail-pos-docs']!);
    },
    candidate(label: string, shared = false): Candidate {
      return {
        action: 'page',
        target: null,
        title: `Verified ${alternate ? 'authentication' : 'network'} ${label}`,
        content: alternate
          ? `Fictional omitted authentication corrected after authorization and a successful test. Finding ${label}.`
          : `Fictional Wi-Fi connection recovered after selecting the intended network and three observed checks. Finding ${label}.`,
        record: {
          topicTags: [alternate ? 'requests' : 'connectivity'],
          observedOn: '2026-11-20',
          state: 'approved',
          summary: `Verified synthetic ${label}`,
          applicability: alternate
            ? 'Only a confirmed omitted authentication method, never a 401 alone.'
            : 'Only a confirmed unintended Wi-Fi network, never an Ethernet issue.',
        },
        evidence: [],
        publicSource: shared ? { ref: guide, version: 1 } : null,
      };
    },
  });
}
export async function post(f: Fixture, path: string, body: unknown, owner = f.owner) {
  return f.request(path, owner, { method: 'POST', body: JSON.stringify(body) });
}
export async function thread(f: Fixture, owner = f.owner) {
  return (
    await json(
      await post(
        f,
        '/memory/threads?agentId=support',
        { resourceId: resourceId(f.credentials[owner]!.profile) },
        owner,
      ),
    )
  ).id as string;
}
export async function turn(f: Fixture, id: string, question: string, owner = f.owner) {
  return json(
    await post(
      f,
      '/agents/support/generate',
      { messages: [{ role: 'user', content: question }], memory: { thread: id } },
      owner,
    ),
  );
}
export async function confirm(f: Fixture, id?: string): Promise<ReviewInput> {
  id ??= await thread(f);
  await turn(
    f,
    id,
    `Confirmed: The fictional ${f.example === 'retail-pos' ? 'Wi-Fi network selection was corrected and three checks succeeded. No offline payments were pending.' : 'omitted authentication method was enabled by an authorized operator and the synthetic test returned 200.'} Public reference ${f.guide}, version 1.`,
  );
  const saved = await json(await f.request(`/memory/threads/${id}/messages?agentId=support`));
  const message = [...saved.messages].reverse().find((item: any) => item.role === 'user');
  assert.ok(message, 'Review evidence must be a persisted technician turn');
  return { threadId: id, messageId: message.id, sourceActorId: f.credentials[0]!.profile.actorId, audience: 'private' };
}
export async function pending(f: Fixture, input: ReviewInput, selected: Candidate) {
  f.select(selected);
  const { runId } = await json(await post(f, '/workflows/review/create-run', {}, f.reviewer));
  const started = await json(
    await post(f, `/workflows/review/start-async?runId=${runId}`, { inputData: input }, f.reviewer),
  );
  assert.equal(started.status, 'suspended', JSON.stringify(started));
  const snapshot = await json(await f.request(`/workflows/review/runs/${runId}`, f.reviewer));
  const proposal = snapshot.steps['review-decision'].suspendPayload as Proposal;
  assert.equal(proposal.source.messageId, input.messageId);
  assert.deepEqual(proposal.candidate, selected);
  return { runId: runId as string, proposal };
}
export async function decide(
  f: Fixture,
  run: Awaited<ReturnType<typeof pending>>,
  value: 'approve' | 'reject' = 'approve',
) {
  return json(
    await post(
      f,
      `/workflows/review/resume-async?runId=${run.runId}`,
      {
        step: 'review-decision',
        resumeData: {
          decision: value,
          revision: run.proposal.revision,
          reason: 'Checked the exact synthetic evidence and applicability.',
        },
      },
      f.reviewer,
    ),
  );
}
export async function read(f: Fixture, ref: string, owner = f.owner) {
  return json(await f.request(`/knowledge/support/pages/${encodeURIComponent(ref)}`, owner));
}
export async function snapshot(f: Fixture) {
  const store = await f.supportKnowledge.getStorage();
  const pages = [];
  let cursor: string | undefined;
  do {
    const batch = await store.listPages({ read: 'all', cursor, limit: 100 });
    pages.push(...batch.pages);
    cursor = batch.nextCursor;
  } while (cursor);
  return Promise.all(
    pages.map(async page => ({
      page,
      notes: (await store.listNotes({ pageId: page.id, read: 'all', limit: 100 })).notes,
    })),
  );
}
export function providerInput(f: Fixture, start: number) {
  return JSON.stringify(f.model.requests.slice(start).map(request => request.messages));
}
export async function assertCitations(f: Fixture, text: string, owner = f.owner) {
  const refs = [...text.matchAll(/\[((?:docs|tenant|customer):[^\]\s]+)\]/gu)].map(match => match[1]!);
  assert.ok(refs.length, 'Scored answer must cite visible evidence');
  for (const ref of refs) await read(f, ref, owner);
  for (const match of text.matchAll(/https:\/\/[^\s)]+/gu))
    assert.ok((demoCorpus.sources as readonly string[]).includes(match[0]), `Unsupported URL ${match[0]}`);
  assert.doesNotMatch(text, /RETAILOPS_STORE73|FIELDRETAIL_STORE42|unsupported\.example/u);
}
export async function sql(f: Fixture, query: string, parameters: unknown[] = []): Promise<Record<string, any>[]> {
  const script = `import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.env.PROOF_DATABASE); try { console.log(JSON.stringify(db.prepare(process.env.PROOF_SQL).all(...JSON.parse(process.env.PROOF_PARAMETERS)))); } finally { db.close(); }`;
  const result = await execute(process.execPath, ['--input-type=module', '-e', script], {
    env: {
      ...process.env,
      PROOF_DATABASE: join(f.directory, 'support.db'),
      PROOF_SQL: query,
      PROOF_PARAMETERS: JSON.stringify(parameters),
    },
    timeout: 10000,
  });
  return JSON.parse(result.stdout);
}
