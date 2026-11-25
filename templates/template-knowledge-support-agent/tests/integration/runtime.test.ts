import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { GET_KNOWLEDGE_TREE_ROUTE } from '@mastra/server/handlers/knowledge';
import { resourceId, principals } from '../../src/mastra/identity.ts';
import { approvePolicyRevision, runtimeFixture } from '../fixtures/runtime.ts';
import { startModelServer } from '../fixtures/model-server.ts';

async function json(response: Response, status = 200) {
  const body = await response.text();
  assert.equal(response.status, status, body);
  return JSON.parse(body);
}

async function thread(fixture: Awaited<ReturnType<typeof runtimeFixture>>, owner = 0) {
  return json(
    await fixture.request('/memory/threads?agentId=support', owner, {
      method: 'POST',
      body: JSON.stringify({ resourceId: resourceId(fixture.credentials[owner]!.profile) }),
    }),
  );
}

async function generate(
  fixture: Awaited<ReturnType<typeof runtimeFixture>>,
  id: string,
  owner = 0,
  content = 'Find SYNTHETIC evidence',
) {
  return fixture.request('/agents/support/generate', owner, {
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', content }], memory: { thread: id } }),
  });
}

test('concurrent policy approvals for one file preserve each approved revision', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'support-approvals-'));
  try {
    const file = join(directory, 'approved.json');
    const approvals = Array.from(
      { length: 12 },
      (_, i) => [`tenant:example#policies/safety-${i}`, `Approved safety instructions ${i}.`] as const,
    );
    await writeFile(file, '{}');
    await Promise.all(approvals.map(([ref, body]) => approvePolicyRevision(file, ref, body)));
    const expected = Object.fromEntries(
      approvals.map(([ref, body]) => [ref, [createHash('sha256').update(body).digest('hex')]]),
    );
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), expected);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('dev uses its fixture settings and never probes a different listener', { timeout: 60000 }, async () => {
  const first = await runtimeFixture();
  let second: Awaited<ReturnType<typeof runtimeFixture>> | undefined;
  let foreignRequests = 0;
  const foreign = createServer((_request, response) => {
    foreignRequests++;
    response.writeHead(401).end();
  });
  try {
    const profile = first.credentials[0]!.profile;
    second = await runtimeFixture({
      studioRole: 'different-role',
      profiles: Array.from({ length: 4 }, (_, index) => ({
        ...profile,
        id: `fixture-profile-${index}`,
        customerId: `fixture-customer-${index}`,
      })),
    });
    assert.equal(new Set(second.pages.map(page => page.id)).size, 4);
    const initialBase = first.base;
    foreign.listen(Number(new URL(initialBase).port), '127.0.0.1');
    await once(foreign, 'listening');

    await first.start();
    assert.notEqual(first.base, initialBase);
    assert.equal(foreignRequests, 0);
    const capabilities = await json(await first.request('/auth/capabilities'));
    assert.equal(capabilities.user.id, first.credentials[0]!.profile.id);
    const id = (await thread(first)).id;
    assert.match((await json(await generate(first, id))).text, /Synthetic evidence inspected/u);
    assert.ok(first.model.requests.length);
    assert.equal(second.model.requests.length, 0);
  } finally {
    await Promise.all([first.close(), second?.close(), new Promise<void>(resolve => foreign.close(() => resolve()))]);
  }
});

test('Studio startup can be retried after readiness rejects a fixture credential', { timeout: 60000 }, async () => {
  const f = await runtimeFixture();
  try {
    const credential = f.credentials[0]!;
    const token = credential.token;
    credential.token = 'unrecognized-fixture-credential';
    await assert.rejects(f.start, /Startup HTTP 401/u);
    credential.token = token;
    await f.start();
    assert.equal((await f.request('/knowledge')).status, 200);
  } finally {
    await f.close();
  }
});

test('the model fixture closes connections with incomplete request bodies', { timeout: 10000 }, async t => {
  const model = await startModelServer();
  const { port } = new URL(model.url);
  const socket = createConnection({ host: '127.0.0.1', port: Number(port) });
  // Closing an active request can reset the peer connection.
  socket.on('error', () => {});
  const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
  let closing: Promise<void> | undefined;
  t.after(async () => {
    socket.destroy();
    await (closing ?? model.close());
  });
  socket.setTimeout(2000, () => socket.destroy(new Error('Timed out reading the interim response')));
  await once(socket, 'connect');
  socket.write(
    'POST /v1/chat/completions HTTP/1.1\r\nHost: localhost\r\nExpect: 100-continue\r\nContent-Length: 100\r\n\r\n',
  );
  let interim = '';
  for await (const chunk of socket.iterator({ destroyOnReturn: false })) {
    interim += chunk.toString();
    if (interim.includes('\r\n\r\n')) break;
  }
  assert.match(interim, /^HTTP\/1\.1 100 Continue\r\n\r\n/u);
  socket.setTimeout(0);
  socket.write('{');
  const deadline = new AbortController();
  try {
    closing = model.close();
    await Promise.race([
      Promise.all([closing, closed]),
      setTimeout(2000, undefined, { signal: deadline.signal }).then(() => {
        assert.fail('The model server did not close the incomplete request');
      }),
    ]);
  } finally {
    deadline.abort();
  }
});

test('the model fixture reads the same reference from plain text and text parts', async () => {
  const model = await startModelServer();
  try {
    const ref = 'docs:north#manual';
    const command = `READ_PAGE:${ref}`;
    const pin = [{ type: 'text', text: '<pinned-knowledge>READ_PAGE:docs:north#policy</pinned-knowledge>' }];
    for (const content of [command, [{ type: 'text', text: command }]]) {
      const result = await json(
        await fetch(`${model.url}/chat/completions`, {
          method: 'POST',
          body: JSON.stringify({
            messages: [
              { role: 'user', content },
              { role: 'user', content: pin },
            ],
          }),
          signal: AbortSignal.timeout(2000),
        }),
      );
      const tool = result.choices[0].message.tool_calls[0].function;
      assert.equal(tool.name, 'knowledge_read');
      assert.deepEqual(JSON.parse(tool.arguments), { page: ref });
    }
  } finally {
    await model.close();
  }
});

test('the model fixture returns an error for non-JSON tool arguments and stays available', async () => {
  const model = await startModelServer(body =>
    body.stream
      ? { tool: { name: 'knowledge_search', arguments: { query: 1n } } }
      : { content: 'The fixture is still available.' },
  );
  try {
    const request = (stream: boolean) =>
      fetch(`${model.url}/chat/completions`, {
        method: 'POST',
        body: JSON.stringify({ stream, messages: [{ role: 'user', content: 'Find synthetic evidence' }] }),
        signal: AbortSignal.timeout(2000),
      });
    const failed = await json(await request(true), 400);
    assert.equal(failed.error.type, 'fixture_assertion');
    const successful = await json(await request(false));
    assert.equal(successful.choices[0].message.content, 'The fixture is still available.');
  } finally {
    await model.close();
  }
});

test('local_studio_boots_and_scoped_state_survives_restart', { timeout: 120000 }, async () => {
  const fixture = await runtimeFixture({ generatedCredentials: 'empty' });
  try {
    await fixture.start();
    assert.match(await (await fetch(fixture.base)).text(), /<html/u);
    const capabilities = await json(await fixture.request('/auth/capabilities'));
    assert.equal(capabilities.user.id, fixture.credentials[0]!.profile.id);
    const activeFile = fixture.credentialFile()!;
    const activeCredentials = await readFile(activeFile, 'utf8');
    const injectedCredentials = await readFile(fixture.injectedCredentialFile, 'utf8');
    const activeOutput = fixture.output();
    await assert.rejects(fixture.start(), /Stop the existing runtime/u);
    assert.equal(fixture.credentialFile(), activeFile);
    assert.ok(fixture.output().includes(activeOutput), 'The rejected start must preserve the active launch output');
    const fileInfo = await stat(activeFile);
    if (process.platform !== 'win32') assert.equal(fileInfo.mode & 0o777, 0o600);
    const duplicate = await fixture.duplicateStart();
    assert.match(duplicate.output, /Another development server instance is already running/u);
    assert.notEqual(duplicate.file, activeFile);
    await assert.rejects(() => stat(duplicate.file), { code: 'ENOENT' });
    assert.ok(
      (await readFile(activeFile, 'utf8')) === activeCredentials,
      'Active credential file must remain unchanged',
    );
    assert.ok(
      (await readFile(fixture.injectedCredentialFile, 'utf8')) === injectedCredentials,
      'Injected credential file must remain unchanged',
    );
    assert.equal((await json(await fixture.request('/auth/capabilities'))).user.id, fixture.credentials[0]!.profile.id);
    const expiredCapabilities = await json(
      await fetch(`${fixture.base}/api/auth/capabilities`, {
        headers: { authorization: `Bearer ${fixture.expired.token}` },
      }),
    );
    assert.equal(expiredCapabilities.user, undefined);
    assert.deepEqual((await json(await fixture.request('/knowledge'))).instances, [{ key: 'support', id: 'support' }]);
    const mixedCase = { headers: { authorization: `bEaReR ${fixture.credentials[0]!.token}` } };
    assert.deepEqual((await json(await fixture.request('/knowledge', 0, mixedCase))).instances, [
      { key: 'support', id: 'support' },
    ]);
    assert.equal((await json(await fixture.request('/auth/me', 0, mixedCase))).id, fixture.credentials[0]!.profile.id);
    const first = await thread(fixture);
    const result = await json(await generate(fixture, first.id));
    assert.match(result.text, /Synthetic evidence inspected/u);
    const page = await json(await fixture.request(`/knowledge/support/pages/${fixture.pages[0]!.id}`));
    assert.match(JSON.stringify(page), /SYNTHETIC_PRIVATE_0/u);
    assert.match(JSON.stringify(page), /SYNTHETIC_NOTE_0/u);
    const before = await json(await fixture.request(`/memory/threads/${first.id}/messages?agentId=support`));
    assert.match(JSON.stringify(before), /Find SYNTHETIC evidence/u);
    await fixture.stop();
    await assert.rejects(() => stat(activeFile), { code: 'ENOENT' });
    assert.ok(
      (await readFile(fixture.injectedCredentialFile, 'utf8')) === injectedCredentials,
      'Injected credential file must remain unchanged',
    );
    await fixture.start();
    assert.notEqual(fixture.credentialFile(), activeFile);
    assert.deepEqual(await json(await fixture.request(`/memory/threads/${first.id}/messages?agentId=support`)), before);
    const after = await json(await fixture.request(`/knowledge/support/pages/${fixture.pages[0]!.id}`));
    assert.deepEqual(after, page);
  } catch (error) {
    console.error(fixture.output());
    throw error;
  } finally {
    await fixture.close();
  }
});

test('http_agent_and_memory_reject_foreign_scope_and_thread', { timeout: 120000 }, async () => {
  const fixture = await runtimeFixture({ studioRole: 'support-specialist' });
  try {
    await fixture.start();
    assert.equal((await fetch(`${fixture.base}/api/knowledge`)).status, 401);
    const settingsPath = '/editor/builder/settings';
    assert.equal((await fetch(`${fixture.base}/api${settingsPath}`)).status, 401);
    const settings = await json(await fixture.request(settingsPath));
    assert.equal(settings.enabled, false);
    assert.deepEqual(settings.modelPolicy, { active: false });
    assert.equal(
      (await fetch(`${fixture.base}/api/knowledge`, { headers: { authorization: `Bearer ${fixture.expired.token}` } }))
        .status,
      401,
    );
    const context = new RequestContext();
    context.set(MASTRA_RESOURCE_ID_KEY, resourceId(fixture.credentials[0]!.profile));
    // Native Knowledge explicitly refuses an authenticated caller without trusted principals.
    await assert.rejects(
      () =>
        GET_KNOWLEDGE_TREE_ROUTE.handler({
          mastra: fixture.mastra,
          requestContext: context,
          knowledgeKey: 'support',
        } as never),
      /not mapped/u,
    );
    for (const path of [
      '/workflows',
      '/observability/traces',
      '/tools/knowledge_page/execute',
      '/editor/builder/models/available',
    ]) {
      assert.ok(
        [403, 404].includes(
          (
            await fixture.request(path, 0, {
              method: path.includes('execute') ? 'POST' : 'GET',
              body: path.includes('execute') ? '{}' : undefined,
            })
          ).status,
        ),
      );
    }
    assert.equal((await fixture.request('/knowledge/other/tree')).status, 403);
    assert.ok([403, 404].includes((await fixture.request('/knowledge', 0, { method: 'HEAD' })).status));
    const search = JSON.stringify(await json(await fixture.request('/knowledge/support/search?q=SYNTHETIC')));
    assert.match(search, /SYNTHETIC_PRIVATE_0/u);
    for (const index of [1, 2, 4, 5]) {
      assert.doesNotMatch(search, new RegExp(`SYNTHETIC_PRIVATE_${index}`));
      assert.equal((await fixture.request(`/knowledge/support/pages/${fixture.pages[index]!.id}`)).status, 404);
      assert.match(
        JSON.stringify(
          await json(await fixture.request(`/knowledge/support/pages/${fixture.pages[index]!.id}`, index)),
        ),
        new RegExp(`SYNTHETIC_PRIVATE_${index}`),
      );
    }
    assert.doesNotMatch(search, /SYNTHETIC_NOTE_[1245]|SYNTHETIC_FOREIGN_STAMP_1/u);
    assert.match(
      JSON.stringify(await json(await fixture.request('/knowledge/support/search?q=SYNTHETIC_FOREIGN_STAMP_1', 1))),
      /SYNTHETIC_FOREIGN_STAMP_1/u,
    );
    const explanation = await fixture.supportKnowledge.explainAccess(principals(fixture.credentials[0]!.profile), {
      scope: 'customer:north:store-1',
    });
    assert.equal(explanation.role, 'viewer');
    for (const scope of ['customer:north:store-2', 'customer:south:store-1']) {
      assert.equal(
        (await fixture.supportKnowledge.explainAccess(principals(fixture.credentials[0]!.profile), { scope })).role,
        null,
      );
    }
    const own = await thread(fixture);
    const independent = await thread(fixture);
    const foreign = await thread(fixture, 1);
    const draftThread = randomUUID();
    const studioBody = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Find SYNTHETIC evidence' }] }],
      runId: randomUUID(),
      maxSteps: 15,
      untilIdle: true,
      modelSettings: { maxRetries: 2 },
      requestContext: {},
      memory: { thread: draftThread, resource: 'support' },
      tracingOptions: {},
    };
    const streamed = await fixture.request('/agents/support/stream', 0, {
      method: 'POST',
      body: JSON.stringify(studioBody),
    });
    assert.equal(streamed.status, 200);
    assert.match(await streamed.text(), /Synthetic evidence inspected/u);
    assert.equal(
      (await fixture.memory.getThreadById({ threadId: draftThread }))?.resourceId,
      resourceId(fixture.credentials[0]!.profile),
    );
    assert.equal(
      (
        await fixture.request('/agents/support/stream', 1, {
          method: 'POST',
          body: JSON.stringify({ ...studioBody, runId: randomUUID() }),
        })
      ).status,
      403,
    );
    for (const forged of [
      { modelSettings: { maxRetries: 2, temperature: 1 } },
      { requestContext: { mastra__scopes: ['customer:south:store-1'] } },
      { tracingOptions: { metadata: { customer: 'foreign' } } },
      { maxSteps: 100 },
      { scopes: ['customer:south:store-1'] },
    ]) {
      assert.equal(
        (
          await fixture.request('/agents/support/stream', 0, {
            method: 'POST',
            body: JSON.stringify({ ...studioBody, ...forged }),
          })
        ).status,
        403,
      );
    }
    const preservedMessages = await json(
      await fixture.request(`/memory/threads/${draftThread}/messages?agentId=support`),
    );
    const requestCount = fixture.model.requests.length;
    for (const route of ['generate', 'stream']) {
      for (const metadata of [
        { id: 'synthetic-client-metadata' },
        { createdAt: '2000-01-01T00:00:00.000Z' },
        { id: 'another-synthetic-id', createdAt: '2001-01-01T00:00:00.000Z' },
      ]) {
        const base = route === 'stream' ? studioBody : { memory: { thread: draftThread } };
        const message =
          route === 'stream' ? studioBody.messages[0]! : { role: 'user', content: 'Synthetic schema validation input' };
        const response = await fixture.request(`/agents/support/${route}`, 0, {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            messages: [{ ...message, ...metadata }],
          }),
        });
        assert.equal(response.status, 403);
        assert.equal(fixture.model.requests.length, requestCount);
        assert.deepEqual(
          await json(await fixture.request(`/memory/threads/${draftThread}/messages?agentId=support`)),
          preservedMessages,
        );
      }
    }
    fixture.model.requests.length = 0;
    const identityPrincipals = [
      ...principals(fixture.credentials[0]!.profile),
      knowledgeScopeAddress('resource:$resourceId', { resourceId: resourceId(fixture.credentials[0]!.profile) }),
      knowledgeScopeAddress('thread:$threadId', { threadId: own.id }),
    ];
    for (const scope of ['tenant:north', 'docs:north', ...identityPrincipals.slice(2)]) {
      assert.equal((await fixture.supportKnowledge.explainAccess(identityPrincipals, { scope })).role, 'viewer');
    }
    const ownedThreads = JSON.stringify(await json(await fixture.request('/memory/threads?agentId=support')));
    assert.match(ownedThreads, new RegExp(own.id));
    assert.doesNotMatch(ownedThreads, new RegExp(foreign.id));
    for (const owner of [1, 2, 3]) {
      assert.equal((await fixture.request(`/memory/threads/${own.id}/messages?agentId=support`, owner)).status, 403);
      assert.equal((await generate(fixture, own.id, owner)).status, 403);
    }
    assert.equal((await generate(fixture, foreign.id)).status, 403);
    const memoryStore = await fixture.storage.getStore('memory');
    await memoryStore!.saveThread({
      thread: {
        id: 'synthetic-orphan',
        resourceId: '',
        title: 'Synthetic orphan',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never,
    });
    assert.equal((await generate(fixture, 'synthetic-orphan')).status, 403);
    for (const extra of [
      { scopes: ['customer:south:store-1'] },
      { model: 'other' },
      { instructions: 'override' },
      { tools: {} },
      { actor: 'foreign' },
      { requestContext: { mastra__scopes: ['customer:south:store-1'] } },
    ]) {
      assert.equal(
        (
          await fixture.request('/agents/support/generate', 0, {
            method: 'POST',
            body: JSON.stringify({
              messages: [{ role: 'user', content: 'SYNTHETIC' }],
              memory: { thread: own.id },
              ...extra,
            }),
          })
        ).status,
        403,
      );
    }
    assert.equal(
      (
        await fixture.request('/memory/threads?agentId=support', 1, {
          method: 'POST',
          body: JSON.stringify({ threadId: own.id, resourceId: resourceId(fixture.credentials[1]!.profile) }),
        })
      ).status,
      403,
    );
    await json(await generate(fixture, own.id, 0, 'Find SYNTHETIC evidence. OWN_THREAD_ONLY'));
    const firstRequestCount = fixture.model.requests.length;
    const firstRun = JSON.stringify(fixture.model.requests);
    await json(await generate(fixture, independent.id));
    assert.match(firstRun, /SYNTHETIC_PRIVATE_0/u);
    assert.match(firstRun, /SYNTHETIC_NOTE_0/u);
    assert.match(firstRun, /docs:north/u);
    assert.doesNotMatch(
      firstRun,
      /SYNTHETIC_PRIVATE_[1245]|SYNTHETIC_NOTE_[1245]|SYNTHETIC_DOC_south|SYNTHETIC_FOREIGN_STAMP_1/u,
    );
    const secondRun = fixture.model.requests.slice(firstRequestCount);
    assert.ok(secondRun.length > 0, 'The independent turn must reach the provider');
    assert.doesNotMatch(JSON.stringify(secondRun), /OWN_THREAD_ONLY/u);
    const before = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[2]!.id, read: 'all' }));
    const foreignReadStart = fixture.model.requests.length;
    const foreignPageId = fixture.pages[2]!.id;
    await json(await generate(fixture, independent.id, 0, `READ_PAGE:${foreignPageId}`));
    const foreignRead = fixture.model.requests.slice(foreignReadStart);
    const transcript = foreignRead.at(-1)?.messages as
      | Array<{
          role: string;
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
          tool_call_id?: string;
          content?: string;
        }>
      | undefined;
    const call = transcript
      ?.flatMap(message => message.tool_calls ?? [])
      .find(
        call => call.function.name === 'knowledge_read' && JSON.parse(call.function.arguments).page === foreignPageId,
      );
    assert.ok(call, 'The agent must attempt to read the foreign page');
    const denied = transcript?.find(message => message.role === 'tool' && message.tool_call_id === call.id);
    assert.match(denied?.content ?? '', /denied|not found|not readable/iu);
    assert.doesNotMatch(JSON.stringify(foreignRead), /SYNTHETIC_PRIVATE_2/u);
    const after = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[2]!.id, read: 'all' }));
    assert.deepEqual(after, before);
    const advertised = fixture.model.requests[0]!.tools as { function: { name: string } }[];
    assert.deepEqual(advertised.map(tool => tool.function.name).sort(), [
      'knowledge_activity',
      'knowledge_list',
      'knowledge_pin',
      'knowledge_read',
      'knowledge_search',
    ]);
    const ownBefore = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[0]!.id, read: 'all' }));
    assert.ok(
      [403, 404].includes(
        (
          await fixture.request('/tools/knowledge_page/execute', 0, {
            method: 'POST',
            body: JSON.stringify({
              data: { op: 'write', page: fixture.pages[0]!.id, body: 'UNAUTHORIZED_REPLACEMENT' },
            }),
          })
        ).status,
      ),
    );
    const ownAfter = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[0]!.id, read: 'all' }));
    assert.deepEqual(ownAfter, ownBefore);
    for (const owner of [4, 5]) {
      const start = fixture.model.requests.length;
      const isolated = await thread(fixture, owner);
      await json(await generate(fixture, isolated.id, owner));
      const captured = JSON.stringify(fixture.model.requests.slice(start));
      assert.match(captured, new RegExp(`SYNTHETIC_PRIVATE_${owner}`));
      assert.doesNotMatch(captured, new RegExp(`SYNTHETIC_PRIVATE_${owner === 4 ? 5 : 4}`));
      assert.equal((await generate(fixture, isolated.id, owner === 4 ? 5 : 4)).status, 403);
    }
    const injectedCredentials = await readFile(fixture.injectedCredentialFile, 'utf8');
    await fixture.stop();
    assert.ok(
      (await readFile(fixture.injectedCredentialFile, 'utf8')) === injectedCredentials,
      'Injected credential file must survive launcher exit',
    );
  } catch (error) {
    console.error(fixture.output());
    throw error;
  } finally {
    await fixture.close();
  }
});
