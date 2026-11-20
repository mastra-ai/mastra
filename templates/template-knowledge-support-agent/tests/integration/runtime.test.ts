import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { knowledgeScopeAddress } from '@mastra/core/knowledge';
import { RequestContext, MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { GET_KNOWLEDGE_TREE_ROUTE } from '@mastra/server/handlers/knowledge';
import { resourceId, principals } from '../../src/mastra/identity.ts';
import { runtimeFixture } from '../fixtures/runtime.ts';

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

test('local_studio_boots_and_scoped_state_survives_restart', { timeout: 120000 }, async () => {
  const fixture = await runtimeFixture({ generatedCredentials: true });
  try {
    await fixture.start();
    assert.match(await (await fetch(fixture.base)).text(), /<html/u);
    const capabilities = await json(await fixture.request('/auth/capabilities'));
    assert.equal(capabilities.user.id, fixture.credentials[0]!.profile.id);
    const activeFile = fixture.credentialFile()!;
    const activeCredentials = await readFile(activeFile, 'utf8');
    const injectedCredentials = await readFile(fixture.injectedCredentialFile, 'utf8');
    assert.equal((await stat(activeFile)).mode & 0o777, 0o600);
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
    for (const path of ['/workflows', '/observability/traces', '/tools/knowledge_page/execute']) {
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
        const response = await fixture.request(`/agents/support/${route}`, 0, {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            messages: [{ role: 'user', content: 'Synthetic schema validation input', ...metadata }],
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
    const secondRun = JSON.stringify(fixture.model.requests.slice(firstRequestCount));
    assert.doesNotMatch(secondRun, /OWN_THREAD_ONLY/u);
    const before = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[2]!.id, read: 'all' }));
    await json(await generate(fixture, independent.id, 0, `READ_PAGE:${fixture.pages[2]!.id}`));
    const latest = JSON.stringify(fixture.model.requests.slice(-2));
    assert.doesNotMatch(latest, /SYNTHETIC_PRIVATE_2/u);
    const after = await fixture.supportKnowledge
      .getStorage()
      .then(store => store.getPage({ id: fixture.pages[2]!.id, read: 'all' }));
    assert.deepEqual(after, before);
    const advertised = fixture.model.requests[0]!.tools as { function: { name: string } }[];
    assert.deepEqual(advertised.map(tool => tool.function.name).sort(), [
      'knowledge_list',
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
