import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { runtimeFixture } from './runtime.ts';
import { demoCorpus } from './demo-corpus.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { retailProfiles, exampleReviewers } from '../../src/examples/retail-pos/profiles.ts';
import { integrationProfiles, integrationReviewers } from '../../src/examples/runtime.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import type { Candidate, Proposal, ReviewInput } from '../../src/mastra/review/contracts.ts';
import { messageText, type ScriptedReply } from './model-server.ts';

const execute = promisify(execFile);
export type Fixture = Awaited<ReturnType<typeof demoFixture>>;
type Message = { role: string; content?: unknown };
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
  return (body.messages as Message[]).map(message => ({
    ...message,
    content: messageText(message.content),
  }));
}
export function history(body: Record<string, unknown>): History {
  const item = messages(body).find(message => message.content.startsWith('Customer history preflight'))?.content;
  assert.ok(item, 'Scoped preflight must reach the real provider');
  return JSON.parse(item.slice(item.indexOf('\n') + 1));
}
export function latest(body: Record<string, unknown>) {
  const list = messages(body);
  let index = list.length - 1;
  while (index >= 0 && (list[index]!.role !== 'user' || list[index]!.content.startsWith('<pinned-knowledge'))) index--;
  return {
    question: list[index]?.content ?? '',
    tools: list.slice(index + 1).filter(message => message.role === 'tool'),
  };
}
function parsedTool(message: { content: string } | undefined): Record<string, any> {
  assert.ok(message, 'Expected a model tool result');
  return JSON.parse(message.content);
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
  const publicSource = { ref: guide, version: 1 };
  const publicUrl = alternate ? demoCorpus.sources[3] : demoCorpus.sources[0];
  const profiles = alternate ? integrationProfiles : retailProfiles;
  const reviewerProfile = alternate
    ? integrationReviewers[0]!
    : exampleReviewers.find(profile => profile.id === 'retailops-reviewer')!;
  const customerScope = knowledgeScopeAddress('customer:$tenantId:$customerId', { ...reviewerProfile });
  let selected: Candidate;
  let reuse: string | undefined;
  const f = await runtimeFixture({
    example,
    syntheticKnowledge: false,
    profiles: [...profiles, { ...reviewerProfile, review: true }],
    modelScript: body => {
      const list = messages(body);
      const allTools = list.filter(message => message.role === 'tool');
      if (list.some(message => message.content.includes('Review one confirmed customer outcome'))) {
        assert.ok(selected, 'Review scenario must select a candidate');
        const { audience } = JSON.parse(list.find(message => message.role === 'user')!.content);
        if (!allTools.length)
          return {
            tool: {
              name: 'knowledge_search',
              arguments: {
                query: alternate ? 'authentication' : 'network',
                ...(audience === 'tenant' ? { scope: [customerScope] } : {}),
              },
            },
          };
        for (const tool of allTools) {
          const { results } = parsedTool(tool);
          assert.ok(Array.isArray(results), 'Curator must receive a Knowledge search result');
          for (const result of results) {
            // Both page and note hits include the containing page.
            assert.equal(result.page.scope ?? result.page.address, customerScope);
            assert.equal(result.page.ref.split('#', 1)[0], customerScope);
          }
        }
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
        const policyRef = `tenant:${tenant}#policies/safe-changes`;
        const policy = list
          .filter(message => message.content.startsWith('<pinned-knowledge'))
          .flatMap(message => message.content.split(/\n {2}(?:•|\+|~ changed|- removed) \{id: [^}]+\}/u).slice(1))
          .reverse()
          .find(pin => pin.split('\n', 1)[0]?.includes(` (${policyRef}, v`));
        assert.ok(policy, `Provider must receive the required policy pin ${policyRef}`);
        assert.match(
          policy,
          alternate
            ? /Never request, paste, or log credential values/u
            : /factory resetting while offline payments remain pending/u,
        );
        const revised = question.includes('F5:policy-revision');
        if (revised) assert.ok(policy.includes(sentinels.policy), 'The required policy pin must contain the revision');
        return {
          content: revised
            ? `${sentinels.policy}. The required current policy blocks this unsafe change.`
            : `The required current policy blocks this unsafe change [${policyRef}].`,
        };
      }
      if (question.includes('F5:conflict')) {
        assert.equal(prepared.records.length, 2);
        for (const expected of demoCorpus.conflictObservations) {
          const ref = `${customerScope}#${expected.path}`;
          const observed = prepared.records.find(record => record.ref === ref);
          assert.ok(observed, `Provider must receive the distinct observation ${ref}`);
          assert.equal(observed.summary, expected.summary);
          assert.equal(observed.applicability, expected.applicability);
        }
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
        const denial = tools[0]!.content;
        assert.ok(denial.startsWith(`Knowledge page "${ref}" not found.`), denial);
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
        const page = parsedTool(tools[1]).page;
        assert.deepEqual(
          page.body.split('\n').filter((line: string) => line.startsWith('Public source:')),
          [`Public source: [[${publicSource.ref}]] (v${publicSource.version})`],
        );
        if (tools.length === 2) return { tool: { name: 'knowledge_read', arguments: { page: guide } } };
        const source = parsedTool(tools[2]).page;
        assert.equal(source.ref, guide);
        assert.ok(source.body.includes(publicUrl));
        return {
          content: `Use only when the observed conditions match. Reviewed finding [${page.ref}] cites public source [${guide}] (${publicUrl}).`,
        };
      }
      if (question.includes('F5:numbered-read')) {
        assert.ok(reuse);
        const from = question.includes('F5:numbered-read-offset') ? { line: 1, col: 'Example '.length } : undefined;
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: reuse, from } } };
        const { page } = parsedTool(tools[0]);
        assert.equal(page.ref, reuse);
        assert.equal(page.body, undefined);
        assert.match(page.lines, /^ *1│<!-- knowledge-review:/u);
        if (from) assert.deepEqual(page.range.start, from);
        return { content: `The numbered excerpt contains the requested text [${reuse}].` };
      }
      if (question.includes('F5:notes')) {
        const ref = question.split('READ=')[1]!.split(' ')[0]!;
        if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: ref, notes: true } } };
        const markers: Record<string, string> = {
          'customer:retailops:store-73#cases/hub-cable': 'RETAILOPS_STORE73_NOTE_SILVER',
          'customer:fieldretail:store-42#cases/wifi-selection': 'FIELDRETAIL_STORE42_NOTE_TEAL',
        };
        const marker = markers[ref];
        assert.ok(marker, `Expected a follow-up marker for ${ref}`);
        const response = parsedTool(tools[0]);
        assert.equal(response.page?.ref, ref);
        assert.ok(
          response.notes?.some((note: { text: string }) => note.text.includes(marker)),
          `Provider must receive the expected follow-up for ${ref}`,
        );
        return { content: `The attributed fictional follow-up is visible [${ref}].` };
      }
      if (question.includes('F5:backlink')) {
        const ref = question.split('READ=')[1]!;
        const notes = question.includes('F5:backlink-and-notes');
        if (!tools.length)
          return { tool: { name: 'knowledge_read', arguments: { page: ref, mentionedIn: true, notes } } };
        const result = parsedTool(tools[0]);
        assert.equal(result.page.ref, ref);
        assert.ok(
          result.mentionedIn.some((note: { text: string }) => note.text.includes('REVIEWED_BACKLINK_MARIGOLD')),
        );
        if (notes)
          assert.ok(
            result.notes.some((note: { text: string }) => note.text.includes('REVIEWED_NOTE_PRIVATE_MARIGOLD')),
          );
        else assert.equal(result.notes, undefined);
        return { content: `The attributed fictional backlink is visible [${ref}].` };
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
      { ...config, directory: join(copied, basename(config.directory)) },
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
      return seedDataset(configs[id]!, { databaseUrl: f.databaseUrl });
    },
    async revisePolicy() {
      const path = join(copied, alternate ? 'software-integration/policy.md' : 'retail-pos/retail-policy.md');
      const body = (await readFile(path, 'utf8')).trimEnd();
      const revised = `${body}\n\nExample team policy: ${sentinels.policy}.`;
      const store = await f.supportKnowledge.getStorage();
      for (const scope of await store.getScopesByAddress(
        alternate ? ['tenant:software'] : ['tenant:retailops', 'tenant:fieldretail'],
      )) {
        const current = await store.getPageByPath({
          scopeId: scope.id,
          path: ['policies', 'safe-changes'],
          read: 'all',
        });
        assert.ok(current?.body?.includes(body));
        await f.approvePolicy(`${scope.address}#policies/safe-changes`, current!.body!.replace(body, revised));
      }
      await writeFile(path, `${revised}\n`);
      return seedDataset(configs[alternate ? 'software-integration' : 'retail-pos-docs']!, {
        databaseUrl: f.databaseUrl,
        policyApprovalFile: f.policyApprovalFile,
      });
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
        publicSource: shared ? publicSource : null,
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
export async function turn(
  f: Fixture,
  id: string,
  question: string | { type: 'text'; text: string }[],
  owner = f.owner,
) {
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
  const threadId = id ?? (await thread(f));
  const text = `Confirmed: The fictional ${f.example === 'retail-pos' ? 'Wi-Fi network selection was corrected and three checks succeeded. No offline payments were pending.' : 'omitted authentication method was enabled by an authorized operator and the synthetic test returned 200.'} Public reference ${f.guide}, version 1.`;
  const profile = f.credentials[f.owner]!.profile;
  const store = await f.storage.getStore('memory');
  assert.ok(store);
  const options = { threadId, resourceId: resourceId(profile), perPage: false as const };
  const matchingIds = async () => {
    const { messages } = await store.listMessages(options);
    return messages
      .filter(item => item.role === 'user' && messageText(item.content.parts) === text)
      .map(item => item.id);
  };
  // The generate response contains model output. Compare persisted user turns before and after submission.
  const previous = new Set(await matchingIds());
  await turn(f, threadId, text);
  const matches = (await matchingIds()).filter(messageId => !previous.has(messageId));
  assert.equal(matches.length, 1, 'Expected exactly one newly persisted confirmation matching the submitted text');
  return { threadId, messageId: matches[0]!, sourceActorId: profile.actorId, audience: 'private' };
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
    pages.map(async page => {
      const notes = [];
      let cursor: string | undefined;
      do {
        const batch = await store.listNotes({ pageId: page.id, read: 'all', cursor, limit: 100 });
        notes.push(...batch.notes);
        cursor = batch.nextCursor;
      } while (cursor);
      return { page, notes };
    }),
  );
}
export function providerInput(f: Fixture, start: number) {
  return JSON.stringify(f.model.requests.slice(start).map(request => request.messages));
}
export async function assertCitations(f: Fixture, text: string, start: number, owner = f.owner) {
  const requests = f.model.requests.slice(start);
  assert.ok(requests.length, 'Expected at least one model request for the turn');
  const shown = new Set(history(requests[0]!).records.map(record => record.ref));
  for (const request of requests) {
    for (const tool of latest(request).tools) {
      if (!tool.content.startsWith('{')) continue;
      const result = parsedTool(tool);
      if (result.error) continue;
      if (typeof result.page?.ref === 'string') shown.add(result.page.ref);
      if (Array.isArray(result.results)) {
        for (const match of result.results) if (typeof match.page?.ref === 'string') shown.add(match.page.ref);
      }
    }
  }
  const refs = [...text.matchAll(/\[((?:docs|tenant|customer):[^\]\s]+)\]/gu)].map(match => match[1]!);
  assert.ok(refs.length, 'Scored answer must cite visible evidence');
  const evidence = new Map<string, string>();
  for (const ref of new Set(refs)) {
    assert.ok(shown.has(ref), `Citation was absent from this turn's evidence: ${ref}`);
    const { page } = await read(f, ref, owner);
    const source = /^Source: [^\n]* \((https:\/\/[^\s)]+)\)/mu.exec(page?.body ?? '');
    if (source) evidence.set(ref, source[1]!);
  }
  for (const match of text.matchAll(/https?:\/\/[^\s)]+/giu)) {
    const url = match[0];
    assert.ok((demoCorpus.sources as readonly string[]).includes(url), `Unsupported URL ${url}`);
    const ref = /\[((?:docs|tenant|customer):[^\]\s]+)\][ \t]*\($/u.exec(text.slice(0, match.index))?.[1];
    assert.ok(ref, `URL ${url} must accompany a page citation`);
    assert.equal(evidence.get(ref), url, `Public source URL does not match evidence ${ref}`);
  }
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
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(result.stdout);
}
