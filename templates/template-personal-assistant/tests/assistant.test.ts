import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createAssistant } from '../src/mastra/assistant';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { loadConfig } from '../src/mastra/config';
import { isolatedEnv, json, modelFixture, startAssistant } from './helpers';

const agent = 'personalAssistant';
const query = `?agentId=${agent}`;
const preferencePrompt = 'Please remember: Prefer concise bullet points. private-turn-marker';

test('direct tool execution routes cannot bypass native approval', { timeout: 120000 }, async () => {
  const { connectedFixture } = await import('./connections');
  for (const mode of ['hosted', 'local']) {
    const fixture = await connectedFixture();
    const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-direct-tools-'));
    const token = 'example-owner-token-at-least-32-characters';
    const headers: Record<string, string> = mode === 'hosted' ? { authorization: `Bearer ${token}` } : {};
    let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
    try {
      app = await startAssistant(dataDir, fixture.modelUrl, {
        ...fixture.env,
        TEST_SEED_FOREIGN: 'true',
        ...(mode === 'hosted'
          ? {
              ASSISTANT_RUNTIME: 'hosted',
              TURSO_DATABASE_URL: 'libsql://assistant-example.turso.io',
              TURSO_AUTH_TOKEN: 'example-database-token',
              ASSISTANT_API_TOKEN: token,
              MASTRA_PLATFORM_STUDIO_AUTH: 'disabled',
              TEST_AUTH_DATABASE_URL: `file:${join(dataDir, 'assistant.db')}`,
            }
          : {}),
      });
      const bases = ['/tools', `/agents/${agent}/tools`, '/agents/personal-assistant/tools'];
      const write = 'google_docs_create_document';
      const directBody = { data: { title: 'Direct execution must require approval' } };
      // This first public request reproduced a real provider write before the repair.
      const first = await app.request(`/tools/${write}/execute`, 'POST', directBody, headers);
      assert.equal(
        first.status,
        403,
        JSON.stringify({ result: await first.text(), providerCalls: fixture.providerCalls }),
      );
      assert.equal(fixture.providerCalls.length, 0);
      if (mode === 'hosted') {
        for (const credentials of [{}, { authorization: 'Bearer invalid-owner-token' }] as Record<string, string>[]) {
          for (const base of bases) {
            for (const tool of [write, 'connection-status']) {
              const response = await app.request(`${base}/${tool}/execute`, 'POST', directBody, credentials);
              assert.equal(
                response.status,
                tool === 'connection-status' ? 401 : 403,
                `${base}/${tool}: ${await response.text()}`,
              );
            }
          }
        }
      }
      const suspended = await json(
        await app.request(
          `/agents/${agent}/generate`,
          'POST',
          {
            messages: [{ role: 'user', content: 'case:write preserve this pending document request' }],
            memory: { thread: 'owner-thread' },
          },
          headers,
        ),
      );
      assert.equal(suspended.finishReason, 'suspended');
      const pendingPath = `/agents/${agent}/suspended-runs?threadId=owner-thread&resourceId=local-owner`;
      const beforePending = await json(await app.request(pendingPath, 'GET', undefined, headers));
      assert.equal(beforePending.runs.length, 1);
      await json(
        await app.request(
          `/memory/threads/owner-thread/working-memory${query}`,
          'POST',
          {
            workingMemory: 'Owner preference: keep the reviewed document title unchanged.',
          },
          headers,
        ),
      );
      const before = await readState(dataDir);
      const modelCalls = fixture.models.length;
      const scheduleState = await json(await app.request('/schedules', 'GET', undefined, headers));
      const send = (path: string, body: BodyInit, contentType?: string) =>
        fetch(`${app!.url}/api${path}`, {
          method: 'POST',
          headers: { ...headers, ...(contentType ? { 'content-type': contentType } : {}) },
          body,
        });
      const form = (fields: [string, string][]) => {
        const value = new FormData();
        value.set('data', JSON.stringify(directBody.data));
        for (const [key, field] of fields) value.append(key, field);
        return value;
      };
      for (const base of bases) {
        for (const tool of [
          write,
          'google_mail_get_message',
          'google_docs_list_revisions',
          'unknown_tool',
          'connection_status',
        ]) {
          for (const body of [JSON.stringify(directBody), form([])]) {
            const response = await send(
              `${base}/${tool}/execute`,
              body,
              typeof body === 'string' ? 'application/json' : undefined,
            );
            assert.equal(response.status, 403, `${mode} ${base}/${tool}: ${await response.text()}`);
          }
        }
        for (const path of [
          `${base}/%67oogle_docs_create_document/execute`,
          `${base}/${write}/%65xecute`,
          `${base}/${write}/execute/`,
          `${base}/${write}/execute/extra`,
          `${base}/${write}%2Fextra/execute`,
          `${base}/%2563onnection-status/execute`,
          `${base}/connection-status%2Fextra/execute`,
        ]) {
          const response = await send(path, JSON.stringify(directBody), 'application/json');
          assert.ok([403, 404].includes(response.status), `${path}: ${response.status} ${await response.text()}`);
        }
        const statusPath = `${base}/connection-status/execute`;
        const protectedOverride = await send(
          `${base}/${write}/execute?toolId=connection-status`,
          JSON.stringify({ ...directBody, toolId: 'connection-status' }),
          'application/json',
        );
        assert.equal(protectedOverride.status, 403, await protectedOverride.text());
        for (const suffix of [
          `?toolId=${write}`,
          `?toolId=connection-status&toolId=${write}`,
          `?toolId=${write}&toolId=connection-status`,
          `?toolId[value]=${write}`,
          '?agentId=unknown-agent',
        ]) {
          const response = await send(statusPath + suffix, JSON.stringify(directBody), 'application/json');
          assert.equal(response.status, 403, `${statusPath + suffix}: ${await response.text()}`);
        }
        for (const body of [
          JSON.stringify({ ...directBody, toolId: write }),
          `{"data":{},"toolId":"connection-status","toolId":"${write}"}`,
          JSON.stringify({ ...directBody, agentId: 'unknown-agent' }),
          JSON.stringify({ ...directBody, toolId: null }),
          form([['toolId', write]]),
          form([
            ['toolId', '"connection-status"'],
            ['toolId', JSON.stringify(write)],
          ]),
          form([['agentId', '"unknown-agent"']]),
        ]) {
          const response = await send(statusPath, body, typeof body === 'string' ? 'application/json' : undefined);
          assert.equal(response.status, 403, `${statusPath}: ${await response.text()}`);
        }
        // Native JSON and multipart parsing selects the final duplicate field.
        for (const body of [
          JSON.stringify({ data: {} }),
          `{"data":{},"toolId":"${write}","toolId":"connection-status"}`,
          form([
            ['toolId', JSON.stringify(write)],
            ['toolId', '"connection-status"'],
          ]),
        ]) {
          const status = await json(
            await send(statusPath, body, typeof body === 'string' ? 'application/json' : undefined),
          );
          assert.equal(status.state, 'available');
        }
        const encodedStatus = await json(
          await send(`${base}/%63onnection-status/execute`, '{"data":{}}', 'application/json'),
        );
        assert.equal(encodedStatus.state, 'available');
        const matchingQuery = await json(
          await send(`${statusPath}?toolId=connection-status`, '{"data":{}}', 'application/json'),
        );
        assert.equal(matchingQuery.state, 'available');
        const malformed = await json(await send(statusPath, '{', 'application/json'), 400);
        assert.match(malformed.error, /Invalid request body/);
      }
      for (const path of [
        `/agents/%70ersonalAssistant/tools/${write}/execute`,
        `/agents/personal%2Dassistant/tools/${write}/execute`,
        `/agents/${agent}/%74ools/${write}/execute`,
        `/agents/${agent}/tools//${write}/execute`,
        `/extra/tools/${write}/execute`,
        `/%74ools/${write}/execute`,
        `/tools/${write}/execute%2Fextra`,
        '/tools/%zz/execute',
      ]) {
        const response = await send(path, JSON.stringify(directBody), 'application/json');
        assert.ok([403, 404].includes(response.status), `${path}: ${response.status} ${await response.text()}`);
      }
      assert.equal(fixture.providerCalls.length, 0, 'Direct calls cannot read or mutate a provider.');
      assert.equal(fixture.models.length, modelCalls, 'Direct calls cannot start a conversation or model run.');
      assert.deepEqual(await readState(dataDir), before, 'Owner and foreign state must remain unchanged.');
      assert.deepEqual(await json(await app.request(pendingPath, 'GET', undefined, headers)), beforePending);
      assert.deepEqual(await json(await app.request('/schedules', 'GET', undefined, headers)), scheduleState);
      assert.ok(fixture.discovery.every(path => path.includes('resourceId=local-owner')));
    } finally {
      await app?.stop();
      await fixture.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  }
});

test('ordinary execution limits protect native message and approval options', { timeout: 90000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-bounds-'));
  const model = await modelFixture();
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, model.url, {
      ASSISTANT_MAX_STEPS: '1',
      TEST_SEED_FOREIGN: 'true',
    });
    await json(
      await app.request(`/memory/threads${query}`, 'POST', {
        threadId: 'owner-thread',
        resourceId: 'local-owner',
        title: 'Bounded conversation',
      }),
    );
    const before = await readState(dataDir);
    const abortUrl = `${app.url}/api/agents/${agent}/runs/missing-run/abort`;
    for (const options of [
      { method: 'POST' },
      { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'native operation' },
    ]) {
      const native = await json(await fetch(abortUrl, options), 501);
      assert.match(JSON.stringify(native), /durable/i);
    }
    const multipart = new FormData();
    multipart.set('message', preferencePrompt);
    multipart.set('resourceId', 'local-owner');
    multipart.set('threadId', 'owner-thread');
    multipart.append('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { maxSteps: 1 } }));
    multipart.append('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { maxSteps: 2 } }));
    const multipartDenied = await json(
      await fetch(`${app.url}/api/agents/${agent}/send-message`, {
        method: 'POST',
        body: multipart,
      }),
      400,
    );
    assert.match(multipartDenied.error, /maxSteps/);
    const target = { resourceId: 'local-owner', threadId: 'owner-thread' };
    const signal = { type: 'user', contents: preferencePrompt };
    const requests: [string, (maxSteps: unknown) => unknown][] = [
      [
        'send-message',
        maxSteps => ({
          ...target,
          message: preferencePrompt,
          ifIdle: { behavior: 'wake', streamOptions: { maxSteps } },
        }),
      ],
      [
        'queue-message',
        maxSteps => ({
          ...target,
          message: preferencePrompt,
          ifIdle: { behavior: 'wake', streamOptions: { maxSteps } },
        }),
      ],
      [
        'signals',
        maxSteps => ({
          ...target,
          signal,
          ifIdle: { behavior: 'wake', streamOptions: { maxSteps } },
        }),
      ],
      [
        'queue-signal',
        maxSteps => ({
          ...target,
          signal,
          ifIdle: { behavior: 'wake', streamOptions: { maxSteps } },
        }),
      ],
      [
        'send-tool-approval',
        maxSteps => ({
          ...target,
          toolCallId: 'pending-call',
          approved: true,
          streamOptions: { maxSteps },
        }),
      ],
      ...['generate', 'stream', 'stream-until-idle'].map(
        mode =>
          [
            mode,
            (maxSteps: unknown) => ({
              messages: [{ role: 'user', content: preferencePrompt }],
              memory: { thread: 'owner-thread' },
              maxSteps,
            }),
          ] as [string, (maxSteps: unknown) => unknown],
      ),
    ];
    for (const [route, body] of requests) {
      for (const limit of [2, 0, 1.5, '2', null]) {
        const denied = await json(await app.request(`/agents/${agent}/${route}`, 'POST', body(limit)), 400);
        assert.match(denied.error, /maxSteps/);
      }
    }
    assert.equal(model.requests.length, 0, 'Rejected limits must never start a model run.');
    assert.deepEqual(await readState(dataDir), before);

    const prompt = 'Help me plan a focused morning. Explain this data: {"streamOptions":{"maxSteps":99}}';
    const ordinary = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'owner-thread' },
        maxSteps: 1,
      }),
    );
    assert.equal(ordinary.text, 'Preference missing.');
    assert.equal(model.requests.length, 1);
    const allowedForm = new FormData();
    allowedForm.set('resourceId', 'local-owner');
    allowedForm.set('threadId', 'allowed-message-thread');
    allowedForm.set('message', 'Help me plan a focused morning.');
    allowedForm.append('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { maxSteps: 2 } }));
    allowedForm.append('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { maxSteps: 1 } }));
    const sent = await json(
      await fetch(`${app.url}/api/agents/${agent}/send-message`, {
        method: 'POST',
        body: allowedForm,
      }),
    );
    assert.equal(sent.accepted, true);
    let history = '';
    for (let attempt = 0; attempt < 200; attempt++) {
      const response = await app.request(`/memory/threads/allowed-message-thread/messages${query}`);
      if (response.ok) history = JSON.stringify(await response.json());
      if (history.includes('Preference missing.')) break;
      await delay(25);
    }
    assert.match(history, /focused morning/);
    assert.match(history, /Preference missing\./);
    assert.equal(model.requests.length, 2, 'An allowed wake runs within the configured one-step limit.');
  } finally {
    await app?.stop();
    await model.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

async function readState(dataDir: string) {
  const storage = new LibSQLStore({
    id: 'test-state-reader',
    url: `file:${join(dataDir, 'assistant.db')}`,
  });
  await storage.init();
  const memory = new Memory({
    storage,
    options: { workingMemory: { enabled: true, scope: 'resource' } },
  });
  try {
    const state = {} as Record<string, unknown>;
    for (const [threadId, resourceId] of [
      ['owner-thread', 'local-owner'],
      ['foreign-thread', 'foreign-owner'],
    ]) {
      state[threadId] = {
        thread: await memory.getThreadById({ threadId: threadId! }),
        messages: await memory.recall({ threadId: threadId!, resourceId: resourceId! }),
        workingMemory: await memory.getWorkingMemory({
          threadId: threadId!,
          resourceId: resourceId!,
        }),
      };
    }
    return JSON.parse(JSON.stringify(state));
  } finally {
    await storage.close();
  }
}

test('local assistant preserves owner preferences across restart', { timeout: 90000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-memory-'));
  const model = await modelFixture();
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, model.url);
    const answer = await app.request(`/agents/${agent}/stream`, 'POST', {
      messages: [{ role: 'user', content: preferencePrompt }],
      memory: { thread: 'owner-thread', resource: 'local-owner' },
    });
    assert.equal(answer.status, 200, await answer.clone().text());
    assert.match(await answer.text(), /Saved your preference/);
    assert.ok(model.requests.length >= 2, 'The native working-memory tool must complete before the final answer.');
    const saved = await json(await app.request(`/memory/threads/owner-thread/messages${query}`));
    assert.match(JSON.stringify(saved), /private-turn-marker/);
    assert.match(JSON.stringify(saved), /Saved your preference/);
    const working = await json(await app.request(`/memory/threads/owner-thread/working-memory${query}`));
    assert.match(working.workingMemory, /Prefer concise bullet points/);
    await app.stop();
    app = undefined;

    app = await startAssistant(dataDir, model.url);
    const boundary = model.requests.length;
    const next = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'Help me plan a focused morning.' }],
        memory: { thread: 'new-owner-thread', resource: 'local-owner' },
      }),
    );
    assert.match(next.text, /^- Choose one priority/);
    const input = JSON.stringify(model.requests[boundary]!.messages);
    assert.match(input, /Prefer concise bullet points/);
    assert.doesNotMatch(
      input,
      /private-turn-marker/,
      'Previous conversation history must stay in its original thread.',
    );
    const oldHistory = await json(await app.request(`/memory/threads/owner-thread/messages${query}`));
    assert.match(JSON.stringify(oldHistory), /private-turn-marker/);
    assert.match(JSON.stringify(oldHistory), /Saved your preference/);
    const newHistory = await json(await app.request(`/memory/threads/new-owner-thread/messages${query}`));
    assert.match(JSON.stringify(newHistory), /focused morning/);
    assert.match(JSON.stringify(newHistory), /Choose one priority/);
    assert.doesNotMatch(JSON.stringify(newHistory), /private-turn-marker/);
  } finally {
    await app?.stop();
    await model.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('invalid configuration and conflicting identity leave state unchanged', { timeout: 120000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-identity-'));
  const model = await modelFixture();
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, model.url, { TEST_SEED_FOREIGN: 'true' });
    await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: preferencePrompt }],
        memory: { thread: 'owner-thread', resource: 'local-owner' },
      }),
    );
    const before = await readState(dataDir);
    const calls = model.requests.length;
    const foreign = `/memory/threads/foreign-thread${query}`;
    const requests: [string, string, unknown?][] = [
      [foreign, 'GET'],
      [`/memory/threads/foreign-thread/messages${query}&resourceId=foreign-owner`, 'GET'],
      [`/memory/threads/foreign-thread/working-memory${query}&resourceId=foreign-owner`, 'GET'],
      [foreign, 'PATCH', { title: 'stolen', resourceId: 'foreign-owner' }],
      [foreign, 'DELETE'],
      [
        `/memory/threads${query}`,
        'POST',
        { threadId: 'foreign-thread', resourceId: 'foreign-owner', title: 'replaced' },
      ],
      [
        `/memory/threads/foreign-thread/working-memory${query}`,
        'POST',
        { resourceId: 'foreign-owner', workingMemory: 'replaced' },
      ],
      [
        `/memory/threads/foreign-thread/clone${query}`,
        'POST',
        { newThreadId: 'stolen-copy', resourceId: 'foreign-owner' },
      ],
      [`/memory/threads/foreign-thread/transfer${query}`, 'POST', { resourceId: 'local-owner' }],
      [`/memory/messages/delete${query}&resourceId=foreign-owner`, 'POST', { messageIds: ['foreign-message'] }],
      [
        `/memory/save-messages${query}`,
        'POST',
        {
          messages: [
            {
              id: 'foreign-message',
              threadId: 'foreign-thread',
              resourceId: 'foreign-owner',
              role: 'user',
              content: { format: 2, parts: [{ type: 'text', text: 'replaced' }] },
            },
          ],
        },
      ],
      [
        `/agents/${agent}/generate`,
        'POST',
        {
          messages: [{ role: 'user', content: 'Read private context' }],
          memory: { thread: 'foreign-thread', resource: 'foreign-owner' },
          requestContext: {
            mastra__resourceId: 'foreign-owner',
            mastra__scopes: ['resource:foreign-owner'],
          },
        },
      ],
      [
        `/agents/${agent}/stream`,
        'POST',
        {
          messages: [{ role: 'user', content: 'Read private context' }],
          memory: { thread: 'foreign-thread', resource: 'foreign-owner' },
          requestContext: { mastra__resourceId: 'foreign-owner' },
        },
      ],
    ];
    for (const [path, method, body] of requests) {
      const denied = await app.request(path, method, body);
      const result = await denied.text();
      assert.equal(denied.status, 403, `${method} ${path}: ${result}`);
      assert.doesNotMatch(result, /foreign-private-marker|foreign-preference-marker/);
    }
    for (const mode of ['generate', 'stream']) {
      await json(
        await app.request(`/agents/${agent}/${mode}`, 'POST', {
          messages: [{ role: 'user', content: 'excessive run' }],
          maxSteps: 21,
          memory: { thread: 'owner-thread' },
        }),
        400,
      );
    }
    assert.equal(model.requests.length, calls, 'Denied requests must not reach the model.');
    assert.deepEqual(await readState(dataDir), before);

    // Owner reads and writes remain available despite hostile resource/header/context claims.
    const ownerResponse = await fetch(
      `${app.url}/api/memory/threads/owner-thread${query}&requestContext=${encodeURIComponent(JSON.stringify({ mastra__resourceId: 'foreign-owner', mastra__scopes: ['resource:foreign-owner'] }))}`,
      { headers: { 'x-resource-id': 'foreign-owner' } },
    );
    assert.equal((await json(ownerResponse)).resourceId, 'local-owner');
    const ownerUpdate = await json(
      await app.request(`/memory/threads/owner-thread${query}`, 'PATCH', {
        title: 'Owner updated title',
        resourceId: 'foreign-owner',
      }),
    );
    assert.equal(ownerUpdate.resourceId, 'local-owner');
    assert.equal(ownerUpdate.title, 'Owner updated title');
    const ownerList = await json(await app.request(`/memory/threads${query}&resourceId=foreign-owner`));
    assert.match(JSON.stringify(ownerList), /owner-thread/);
    assert.doesNotMatch(JSON.stringify(ownerList), /foreign-thread/);
    const stable = await readState(dataDir);
    await app.stop();
    app = undefined;
    await assert.rejects(startAssistant(dataDir, model.url, { OPENAI_API_KEY: '' }), /OPENAI_API_KEY/);
    assert.deepEqual(await readState(dataDir), stable);
    assert.equal(model.requests.length, calls);

    const native = createAssistant(loadConfig({ OPENAI_API_KEY: 'example-key', ASSISTANT_DATA_DIR: dataDir }), {
      id: 'openai/gpt-6-luna',
      url: model.url,
      apiKey: 'example-key',
    });
    try {
      await assert.rejects(
        native.getAgent(agent).generate('Read foreign context', {
          memory: { thread: 'foreign-thread', resource: 'foreign-owner' },
        }),
        /conflict|resource|scope/i,
      );
      await assert.rejects(
        native.getAgent(agent).generate('Read foreign context', {
          memory: { thread: 'foreign-thread', resource: 'local-owner' },
        }),
        /resource|owner|thread/i,
      );
      assert.deepEqual(await readState(dataDir), stable);
      assert.equal(model.requests.length, calls);
    } finally {
      await native.shutdown();
    }
  } finally {
    await app?.stop();
    await model.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

async function pending(app: Awaited<ReturnType<typeof startAssistant>>, threadId: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await json(
      await app.request(`/agents/${agent}/suspended-runs?threadId=${threadId}&resourceId=local-owner`),
    );
    if (result.runs.length)
      return result.runs[0] as {
        runId: string;
        toolCalls: { toolCallId: string; toolName: string; args: unknown }[];
      };
    await delay(25);
  }
  assert.fail(`No persisted pending approval for ${threadId}.`);
}

test('connected reads respect policy and report unavailable providers', { timeout: 120000 }, async () => {
  const { connectedFixture } = await import('./connections');
  const fixture = await connectedFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-connect-read-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const read = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:read retrieve the full source' }],
        memory: { thread: 'read-thread' },
      }),
    );
    assert.match(read.text, /source-message/);
    assert.equal(fixture.providerCalls.length, 1);
    assert.equal(fixture.providerCalls[0]!.method, 'GET');
    assert.equal(fixture.providerCalls[0]!.resource, 'local-owner');
    assert.ok(fixture.discovery.every(path => path.includes('resourceId=local-owner')));
    fixture.state.providers = ['google-mail'];
    const status = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:status inspect current connections' }],
        memory: { thread: 'status-thread' },
      }),
    );
    assert.match(status.text, /unavailable/);
    assert.match(status.text, /google-docs/);
    assert.match(status.text, /not an empty source result/);
    fixture.state.discoveryStatus = 401;
    const failed = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:status inspect failed credentials' }],
        memory: { thread: 'failed-thread' },
      }),
    );
    assert.match(failed.text, /unavailable/);
    assert.match(failed.text, /refresh failed/);
    assert.equal(fixture.providerCalls.length, 1, 'Discovery failure must not be presented as another source read.');
    assert.doesNotMatch(failed.text, /example-connect-token/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test(
  'reviewed Notion reads run without approval while unknown actions remain protected',
  { timeout: 120000 },
  async () => {
    const { notionAnalysisFixture } = await import('./connections');
    const fixture = await notionAnalysisFixture();
    const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-notion-policy-'));
    let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
    try {
      app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
      const generate = async (thread: string, prompt: string) =>
        json(
          await app!.request(`/agents/${agent}/generate`, 'POST', {
            messages: [{ role: 'user', content: prompt }],
            memory: { thread },
            requireToolApproval: false,
          }),
        );
      for (const page of ['analysis-page', 'another-page']) {
        const read = await generate(`notion-${page}`, `case:notion-read Read ${page}. Do not change the source.`);
        assert.equal(read.finishReason, 'stop', 'The exact reviewed Notion read must finish without approval.');
        assert.match(read.text, /T1: Draft only.*T2: Restart evidence missing.*T3: Conflict unresolved/);
        assert.ok(read.text.includes(`Source: ${page};`));
        const request = fixture.providerCalls.at(-1)!;
        assert.equal(request.method, 'GET');
        assert.ok(request.path.includes(`/v1/pages/${page}/markdown`), request.path);
        assert.match(request.path, /include_transcript=false/);
        assert.equal(request.resource, 'local-owner');
        assert.deepEqual(
          (
            await json(
              await app.request(`/agents/${agent}/suspended-runs?threadId=notion-${page}&resourceId=local-owner`),
            )
          ).runs,
          [],
        );
      }
      for (const [scenario, key] of [
        ['write', 'notion_update_page_markdown'],
        ['unknown', 'notion_retrieve_page'],
      ]) {
        const protectedRun = await generate(
          `notion-${scenario}`,
          `case:notion-${scenario} Perform this requested action.`,
        );
        assert.equal(protectedRun.finishReason, 'suspended', key);
        const approval = await pending(app, `notion-${scenario}`);
        assert.equal(approval.toolCalls[0]!.toolName, key);
        assert.equal(
          fixture.providerCalls.length,
          2,
          'An explicit run option cannot bypass approval before provider execution.',
        );
      }
      assert.equal(fixture.judges.length, 0);
    } finally {
      await app?.stop();
      await fixture.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);

test('external writes require matching approval across restart and policy changes', { timeout: 240000 }, async () => {
  const { connectedFixture } = await import('./connections');
  const fixture = await connectedFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-connect-approval-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const prompt = 'case:write create a document';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const first = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'decline-thread' },
        requireToolApproval: false,
      }),
    );
    assert.equal(first.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 0);
    await json(
      await app.request(`/agents/${agent}/decline-tool-call-generate`, 'POST', {
        runId: first.runId,
        toolCallId: 'call-write-0',
      }),
    );
    assert.equal(fixture.providerCalls.length, 0);
    const second = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'restart-thread' },
      }),
    );
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const recovered = await pending(app, 'restart-thread');
    assert.equal(recovered.runId, second.runId);
    assert.deepEqual(recovered.toolCalls[0]!.args, { title: 'Reviewed title' });
    const wrong = await fetch(`${app.url}/api/agents/${agent}/approve-tool-call-generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: second.runId, toolCallId: 'wrong-call' }),
    });
    assert.ok(wrong.status >= 400);
    assert.equal(fixture.providerCalls.length, 0);
    const changed = await app.request(`/agents/${agent}/resume-stream`, 'POST', {
      runId: second.runId,
      toolCallId: 'call-write-0',
      resumeData: { approved: true, args: { title: 'Altered title' } },
    });
    assert.equal(changed.status, 400);
    assert.equal(fixture.providerCalls.length, 0);
    const direct = await app.request(`/agents/${agent}/tools/google_docs_create_document/execute`, 'POST', {
      data: { title: 'Bypass title' },
    });
    assert.equal(direct.status, 403);
    assert.equal(fixture.providerCalls.length, 0);
    const approved = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: second.runId,
        toolCallId: 'call-write-0',
        requireToolApproval: false,
      }),
    );
    assert.match(approved.text, /existing-document/);
    assert.deepEqual(
      fixture.providerCalls.map(call => call.body),
      [{ title: 'Reviewed title' }],
    );
    const replay = await fetch(`${app.url}/api/agents/${agent}/approve-tool-call-generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ runId: second.runId, toolCallId: 'call-write-0' }),
    });
    assert.ok(replay.status >= 400);
    assert.equal(fixture.providerCalls.length, 1);
    // Every native wake entry uses the same registered tools and cannot lower approval.
    for (const route of ['stream', 'stream-until-idle', 'send-message', 'queue-message', 'signals', 'queue-signal']) {
      const thread = `entry-${route}`;
      const streamOptions = { requireToolApproval: false, maxSteps: 3 };
      const body = route.includes('signal')
        ? {
            threadId: thread,
            resourceId: 'local-owner',
            signal: { type: 'user', contents: prompt },
            ifIdle: { behavior: 'wake', streamOptions },
          }
        : route.includes('message')
          ? {
              threadId: thread,
              resourceId: 'local-owner',
              message: prompt,
              ifIdle: { behavior: 'wake', streamOptions },
            }
          : {
              messages: [{ role: 'user', content: prompt }],
              memory: { thread },
              ...streamOptions,
            };
      const response: Response = await app.request(`/agents/${agent}/${route}`, 'POST', body);
      assert.equal(response.status, 200, await response.clone().text());
      await response.text();
      const run = await pending(app, thread);
      assert.equal(run.toolCalls[0]!.toolName, 'google_docs_create_document');
      assert.equal(fixture.providerCalls.length, 1, route);
    }
    const revoke = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'revoked-thread' },
      }),
    );
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, {
      ...fixture.env,
      ASSISTANT_CONNECT_TOOLS: JSON.stringify(['google_mail_get_message']),
    });
    await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: revoke.runId,
        toolCallId: 'call-write-0',
      }),
    );
    assert.equal(
      fixture.providerCalls.length,
      1,
      'Current policy revocation must prevent execution of the persisted call.',
    );
    for (const option of [{ autoResumeSuspendedTools: true }, { clientTools: {} }, { toolsets: {} }]) {
      const denied: Response = await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread: 'options-thread' },
        ...option,
      });
      assert.equal(denied.status, 400);
    }
    await app.stop();
    app = undefined;
    const previous = Object.fromEntries(Object.keys(fixture.env).map(key => [key, process.env[key]]));
    Object.assign(process.env, fixture.env);
    const native = createAssistant(
      loadConfig({ ...fixture.env, OPENAI_API_KEY: 'example-key', ASSISTANT_DATA_DIR: dataDir }),
      { id: 'openai/gpt-6-luna', url: fixture.modelUrl, apiKey: 'example-key' },
    );
    try {
      const nativeAgent = native.getAgent(agent);
      const generated = await nativeAgent.generate(prompt, {
        memory: { thread: 'direct-native-thread', resource: 'local-owner' },
        requireToolApproval: false,
        autoResumeSuspendedTools: true,
      });
      assert.equal(generated.finishReason, 'suspended');
      assert.equal(fixture.providerCalls.length, 1);
      // Native resume ignores caller-supplied argument replacements and executes the stored, reviewed input.
      await nativeAgent.resumeGenerate(
        { approved: true, args: { title: 'Altered direct title' } },
        { runId: generated.runId, toolCallId: 'call-write-0', requireToolApproval: false },
      );
      assert.equal(fixture.providerCalls.length, 2);
      assert.deepEqual(fixture.providerCalls.at(-1)!.body, { title: 'Reviewed title' });
      const streamed = await nativeAgent.stream(prompt, {
        memory: { thread: 'direct-native-stream', resource: 'local-owner' },
        requireToolApproval: false,
      });
      const output = await streamed.getFullOutput();
      assert.equal(output.finishReason, 'suspended');
      assert.equal(fixture.providerCalls.length, 2);
      assert.ok(output.runId);
      await nativeAgent.declineToolCallGenerate({
        runId: output.runId,
        toolCallId: 'call-write-0',
      });
      assert.equal(fixture.providerCalls.length, 2);
    } finally {
      await native.shutdown();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('encoded provider content preserves evidence and cannot elevate permissions', { timeout: 120000 }, async () => {
  const { connectedFixture, fullMessage } = await import('./connections');
  const fixture = await connectedFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-connect-content-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const result = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:injection review the email' }],
        memory: { thread: 'injection-thread' },
        requireToolApproval: false,
      }),
    );
    assert.equal(result.finishReason, 'suspended');
    assert.deepEqual(
      fixture.providerCalls.map(call => call.method),
      ['GET'],
    );
    const nextInput = JSON.stringify(fixture.models[1]!.messages);
    assert.match(nextInput, /source-message/);
    assert.ok(nextInput.includes(fullMessage.split('\n')[0]!));
    assert.match(nextInput, /Ignore the owner/);
    assert.doesNotMatch(nextInput, /Short snippet is not the full body/);
    assert.doesNotMatch(nextInput, /HTML alternative/);
    const unknown = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:unknown retrieve an unreviewed tool' }],
        memory: { thread: 'unknown-thread' },
        requireToolApproval: false,
      }),
    );
    assert.equal(unknown.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 1);
    await json(
      await app.request(`/agents/${agent}/decline-tool-call-generate`, 'POST', {
        runId: result.runId,
        toolCallId: 'call-injection-1',
      }),
    );
    assert.equal(fixture.providerCalls.length, 1);
    fixture.state.message = {
      id: 'unsupported-source',
      payload: { mimeType: 'text/html', body: { data: 'PGh0bWw-' } },
    };
    const unsupported = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:read retrieve an HTML-only source' }],
        memory: { thread: 'unsupported-thread' },
      }),
    );
    assert.match(unsupported.text, /unsupported-source/);
    assert.match(unsupported.text, /No supported full plain-text/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('partial document writes preserve references without blind retry', { timeout: 120000 }, async () => {
  const { connectedFixture } = await import('./connections');
  const fixture = await connectedFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-connect-partial-'));
  const documentId = 'review-document-partial';
  fixture.state.documentId = documentId;
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const initial = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:partial create a review document' }],
        memory: { thread: 'partial-thread' },
      }),
    );
    assert.equal(fixture.providerCalls.length, 0);
    const created = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: initial.runId,
        toolCallId: 'call-partial-0',
      }),
    );
    assert.equal(created.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 1);
    const pendingInsert = await pending(app, 'partial-thread');
    assert.equal(pendingInsert.toolCalls[0]!.toolName, 'google_docs_insert_text');
    assert.deepEqual(pendingInsert.toolCalls[0]!.args, {
      documentId,
      text: 'Source-grounded review',
      location: { index: 1 },
    });
    const partial = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: created.runId,
        toolCallId: 'call-partial-1',
      }),
    );
    const finalInput = fixture.models.at(-1)!.messages as {
      role: string;
      tool_call_id?: string;
      content: unknown;
    }[];
    const createdInput = finalInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-0',
    );
    const failedInput = finalInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-1',
    );
    assert.ok(createdInput, 'The model must receive the actual creation result.');
    assert.deepEqual(JSON.parse(String(createdInput.content)), {
      documentId,
      revisionId: 'revision-1',
    });
    assert.ok(failedInput, 'The model must receive the insertion failure as a tool result.');
    assert.match(String(failedInput.content), /Content insertion failed\./);
    assert.ok(String(failedInput.content).includes(documentId));
    assert.match(String(failedInput.content), /400/);
    assert.ok(partial.text.includes(documentId));
    assert.match(partial.text, /incomplete/);
    assert.equal(fixture.providerCalls.filter(call => call.path.endsWith('/v1/documents')).length, 1);
    assert.equal(fixture.providerCalls.filter(call => call.path.includes(':batchUpdate')).length, 1);
    const history = await json(await app.request(`/memory/threads/partial-thread/messages${query}`));
    const storedTools = (history.messages as MastraDBMessage[])
      .flatMap(message => message.content.parts)
      .filter(part => part.type === 'tool-invocation');
    const storedCreation = storedTools.findLast(
      part => part.toolInvocation.toolCallId === 'call-partial-0',
    )?.toolInvocation;
    const storedFailure = storedTools.findLast(
      part => part.toolInvocation.toolCallId === 'call-partial-1',
    )?.toolInvocation;
    assert.ok(storedCreation);
    assert.deepEqual(storedCreation.result, { documentId, revisionId: 'revision-1' });
    assert.ok(storedFailure);
    assert.equal(storedFailure.state, 'output-error');
    assert.ok(storedFailure.errorText);
    assert.match(storedFailure.errorText, /Content insertion failed\./);
    assert.ok(storedFailure.errorText.includes(documentId));
    assert.match(storedFailure.errorText, /400/);
    assert.match(JSON.stringify(history), /incomplete/);

    // A real successful insertion must yield a success report, never the partial-failure prose.
    fixture.state.insertStatus = 200;
    const successfulDocumentId = 'review-document-complete';
    fixture.state.documentId = successfulDocumentId;
    const successfulStart = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'case:partial create a completed review document' }],
        memory: { thread: 'complete-thread' },
      }),
    );
    const successfulCreate = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: successfulStart.runId,
        toolCallId: 'call-partial-0',
      }),
    );
    const successfulInsert = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: successfulCreate.runId,
        toolCallId: 'call-partial-1',
      }),
    );
    const successInput = fixture.models.at(-1)!.messages as {
      role: string;
      tool_call_id?: string;
      content: unknown;
    }[];
    const insertionResult = successInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-1',
    );
    assert.ok(insertionResult);
    assert.deepEqual(JSON.parse(String(insertionResult.content)), {
      documentId: successfulDocumentId,
      replies: [{}],
    });
    assert.ok(successfulInsert.text.includes(successfulDocumentId));
    assert.match(successfulInsert.text, /inserted successfully/);
    assert.doesNotMatch(successfulInsert.text, /incomplete|failed/i);
    assert.equal(fixture.providerCalls.filter(call => call.path.endsWith('/v1/documents')).length, 2);
    assert.equal(fixture.providerCalls.filter(call => call.path.includes(':batchUpdate')).length, 2);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

// These journeys keep the native Agent, goal scorer, task tools, server and storage intact.
test('native objectives and tasks preserve unfinished work across restart', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn, taskPlan } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-progress-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'meeting-progress';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.equal((await progressState(dataDir, thread)).objective, undefined, 'Boot must not create an objective.');
    await progressTurn(app, thread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective: 'Prepare a meeting agenda and wait for owner review.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [{ name: 'task_write', args: { tasks: taskPlan } }],
        [{ name: 'task_complete', args: { id: 'research' } }],
        [{ name: 'task_update', args: { id: 'draft', status: 'in_progress' } }],
        [{ name: 'task_update', args: { id: 'review', status: 'in_progress' } }],
      ],
    });
    const before = await progressState(dataDir, thread);
    assert.equal(before.objective?.status, 'active');
    assert.equal(before.objective?.runsUsed, 1);
    assert.deepEqual(
      before.tasks.map(task => [task.id, task.status]),
      [
        ['research', 'completed'],
        ['draft', 'pending'],
        ['review', 'in_progress'],
      ],
    );
    assert.equal(before.tasks.filter(task => task.status === 'in_progress').length, 1);
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.deepEqual(await progressState(dataDir, thread), before);
    const boundary = fixture.models.length;
    const inspected = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'inspect' } }], [{ name: 'task_check', args: {} }]],
    });
    assert.match(inspected.text, /Draft the agenda/);
    const input = JSON.stringify(fixture.models[boundary]!.messages);
    assert.match(input, /Prepare a meeting agenda/);
    assert.match(input, /Draft the agenda/);
    assert.match(input, /Review with the owner/);
    const stable = await progressState(dataDir, thread);
    const rejected = await progressTurn(app, thread, {
      calls: [[{ name: 'task_check', args: {} }], [{ name: 'task_write', args: { tasks: [taskPlan[0]] } }]],
    });
    assert.match(JSON.stringify(rejected), /unfinished task|tripwire/i);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Unsafe native replacement must not drop unfinished entries.',
    );
    const invalid = await progressTurn(app, thread, {
      calls: [
        [{ name: 'task_check', args: {} }],
        [
          {
            name: 'task_write',
            args: { tasks: stable.tasks.map(task => ({ ...task, status: 'in_progress' })) },
          },
        ],
      ],
    });
    assert.match(invalid.text, /only one task|one task.*in_progress|at most one/i);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Native validation must reject multiple in-progress tasks.',
    );
    const freshRequest = fixture.models.length;
    const batch = await progressTurn(app, thread, {
      calls: [
        [
          { name: 'task_write', args: { tasks: stable.tasks } },
          { name: 'task_write', args: { tasks: [stable.tasks[0]] } },
        ],
      ],
    });
    assert.match(batch.text, /unfinished task/);
    assert.deepEqual(
      (await progressState(dataDir, thread)).tasks,
      stable.tasks,
      'Each native hook must read state immediately before its mutation.',
    );
    assert.ok(fixture.models.length > freshRequest);

    const isolatedBoundary = fixture.models.length;
    await progressTurn(app, 'separate-progress', { calls: [[{ name: 'task_check', args: {} }]] });
    assert.deepEqual((await progressState(dataDir, 'separate-progress')).tasks, []);
    assert.equal((await progressState(dataDir, 'separate-progress')).objective, undefined);
    assert.doesNotMatch(
      JSON.stringify(fixture.models[isolatedBoundary]!.messages),
      /Prepare a meeting agenda|Draft the agenda/,
    );
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('objective conflicts and exhausted budgets require explicit continuation', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-goal-budget-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'bounded-goal';
  const objective = 'Prepare a grounded agenda, then wait for owner verification.';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    fixture.state.continueGoal = true;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective, maxEvaluations: 2 } }]],
    });
    const exhausted = (await progressState(dataDir, thread)).objective!;
    assert.equal(exhausted.status, 'paused');
    assert.equal(exhausted.runsUsed, 2);
    assert.equal(exhausted.maxRuns, 2);
    assert.match(exhausted.pausedReason!, /budget/);
    assert.equal(fixture.judges.length, 2, 'The real native loop must stop after exactly two judge evaluations.');
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    assert.deepEqual(
      (await progressState(dataDir, thread)).objective,
      exhausted,
      'Exhausted usage and paused state must survive a full restart.',
    );

    const repeated = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective, maxEvaluations: 5 } }]],
    });
    assert.match(repeated.text, /usage preserved/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    const conflict = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'set', objective: 'Unrelated travel plans' } }]],
    });
    assert.match(conflict.text, /explicit replacement|separate conversation/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    const noBudget = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume' } }]],
    });
    assert.match(noBudget.text, /additional evaluation allowance/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    for (const invalid of [
      { action: 'set', objective: 'Bad limit', maxEvaluations: 0 },
      { action: 'set', objective: 'Bad limit', maxEvaluations: 6 },
      { action: 'resume', additionalEvaluations: 1.5 },
      { action: 'inspect', objective: 'Unexpected field' },
      { action: 'clear' },
      {
        action: 'set',
        objective: 'Thread injection',
        threadId: 'another-thread',
        ownerId: 'foreign-owner',
      },
    ]) {
      await progressTurn(app, thread, { calls: [[{ name: 'objective', args: invalid }]] });
      assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    }
    fixture.state.continueGoal = false;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume', additionalEvaluations: 1 } }]],
    });
    const waiting = (await progressState(dataDir, thread)).objective!;
    assert.equal(waiting.id, exhausted.id);
    assert.equal(waiting.runsUsed, 3);
    assert.equal(waiting.maxRuns, 3);
    assert.equal(waiting.status, 'active', 'Waiting on the final slot stays active until the next native guard.');
    const count = fixture.judges.length;
    await progressTurn(app, thread, {});
    assert.equal(fixture.judges.length, count, 'The exhausted native guard must pause without another judge request.');
    const guarded = (await progressState(dataDir, thread)).objective!;
    assert.equal(guarded.status, 'paused');
    assert.equal(guarded.runsUsed, 3);
    await progressTurn(app, thread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective: 'Replacement explicitly requested; wait for input.',
              replaceExisting: true,
            },
          },
        ],
      ],
    });
    const replacement = (await progressState(dataDir, thread)).objective!;
    assert.notEqual(replacement.id, guarded.id);
    assert.equal(replacement.runsUsed, 1);
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'pause' } }]],
    });
    assert.equal((await progressState(dataDir, thread)).objective?.status, 'paused');
    fixture.state.failJudge = true;
    await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'resume' } }]],
    });
    const failed = (await progressState(dataDir, thread)).objective!;
    assert.equal(failed.status, 'paused');
    assert.match(failed.pausedReason!, /judge|evaluation|fail/i);
    assert.equal(
      failed.runsUsed,
      replacement.runsUsed,
      'A failed judge must not reset or silently consume completed evaluations.',
    );
    fixture.state.failJudge = false;
    const cleared = await progressTurn(app, thread, {
      calls: [[{ name: 'objective', args: { action: 'clear', confirmClear: true } }]],
    });
    assert.match(cleared.text, /not completed/);
    assert.equal((await progressState(dataDir, thread)).objective, undefined);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('incomplete objectives wait for information and preserve approvals', { timeout: 120000 }, async () => {
  const { progressFixture, progressState, progressTurn, taskPlan } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-goal-approval-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const thread = 'missing-topic';
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, {
      ...fixture.env,
      TEST_SEED_FOREIGN: 'true',
    });
    const answer = await progressTurn(app, thread, {
      missing: 'the meeting topic',
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective:
                'Prepare a meeting document. Wait for the missing topic and native owner approval before creating it.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [{ name: 'task_write', args: { tasks: taskPlan } }],
      ],
    });
    assert.match(answer.text, /provide the meeting topic/);
    let state = await progressState(dataDir, thread);
    assert.equal(state.objective?.status, 'active');
    assert.equal(state.objective?.runsUsed, 1);
    assert.ok(state.tasks.every(task => task.status !== 'completed'));
    assert.equal(
      fixture.judges.length,
      1,
      'Missing information must stop the native loop after one waiting evaluation.',
    );
    assert.equal(fixture.providerCalls.length, 0);
    const sent = await app.request(`/agents/${agent}/stream`, 'POST', {
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            calls: [
              [
                {
                  name: 'google_docs_create_document',
                  args: { title: 'Agenda: recovery planning' },
                },
              ],
            ],
          }),
        },
      ],
      memory: { thread, resource: 'local-owner' },
      requireToolApproval: false,
    });
    await sent.text();
    const suspended = await pending(app, thread);
    assert.equal(suspended.toolCalls[0]!.toolName, 'google_docs_create_document');
    assert.equal(fixture.providerCalls.length, 0, 'A goal and task plan grant no external permission.');
    state = await progressState(dataDir, thread);
    assert.notEqual(state.objective?.status, 'done');
    assert.ok(state.tasks.every(task => task.status !== 'completed'));
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    assert.deepEqual(await progressState(dataDir, thread), state);
    const recovered = await pending(app, thread);
    assert.equal(recovered.runId, suspended.runId);
    const declined = await app.request(`/agents/${agent}/decline-tool-call-generate`, 'POST', {
      runId: recovered.runId,
      toolCallId: recovered.toolCalls[0]!.toolCallId,
    });
    await declined.text();
    assert.equal(fixture.providerCalls.length, 0, 'Decline after restart must produce no provider mutation.');
    assert.notEqual((await progressState(dataDir, thread)).objective?.status, 'done');
    assert.ok((await progressState(dataDir, thread)).tasks.every(task => task.status !== 'completed'));
    const calls = fixture.models.length;
    const foreign = await app.request(`/agents/${agent}/generate`, 'POST', {
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ calls: [[{ name: 'task_check', args: {} }]] }),
        },
      ],
      memory: { thread: 'foreign-thread', resource: 'foreign-owner' },
    });
    assert.equal(foreign.status, 403);
    assert.equal(fixture.models.length, calls);
    for (const route of [
      'generate',
      'stream',
      'send-message',
      'queue-message',
      'signals',
      'queue-signal',
      'send-tool-approval',
    ]) {
      const body = {
        messages: [],
        threadId: thread,
        resourceId: 'local-owner',
        toolCallConcurrency: 2,
        streamOptions: { toolCallConcurrency: 2 },
        ifIdle: { behavior: 'wake', streamOptions: { toolCallConcurrency: 2 } },
      };
      assert.match(
        (await json(await app.request(`/agents/${agent}/${route}`, 'POST', body), 400)).error,
        /toolCallConcurrency/,
      );
    }
    const form = new FormData();
    form.set('message', 'Do work');
    form.set('ifIdle', JSON.stringify({ behavior: 'wake', streamOptions: { toolCallConcurrency: 3 } }));
    await json(await fetch(`${app.url}/api/agents/${agent}/send-message`, { method: 'POST', body: form }), 400);
    assert.equal(fixture.models.length, calls);
    for (const options of [{ hooks: { beforeToolCall: null } }, { eagerToolExecution: true }]) {
      const deniedOverride: Response = await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [],
        ...options,
      });
      assert.equal(deniedOverride.status, 400);
    }
    const successThread = 'approved-document-progress';
    await progressTurn(app, successThread, {
      calls: [
        [
          {
            name: 'objective',
            args: {
              action: 'set',
              objective:
                'Create and fill the meeting agenda document with the reviewed content after native owner approval.',
            },
          },
        ],
        [{ name: 'task_check', args: {} }],
        [
          {
            name: 'task_write',
            args: {
              tasks: [
                {
                  id: 'create',
                  content: 'Create the approved document',
                  activeForm: 'Creating the approved document',
                  status: 'in_progress',
                },
                {
                  id: 'insert',
                  content: 'Insert the reviewed agenda',
                  activeForm: 'Inserting the reviewed agenda',
                  status: 'pending',
                },
              ],
            },
          },
        ],
      ],
    });
    fixture.state.continueGoal = false;
    // A requested completion without real insertion/check results must remain unfinished.
    await progressTurn(app, successThread, { complete: true });
    assert.notEqual((await progressState(dataDir, successThread)).objective?.status, 'done');
    fixture.state.failJudge = false;
    // The Connect fixture's provider state controls the actual HTTP insertion response.
    fixture.providerState.insertStatus = 200;
    fixture.providerState.documentId = 'confirmed-agenda';
    const approvedStart = await progressTurn(app, successThread, {
      complete: true,
      calls: [
        [{ name: 'google_docs_create_document', args: { title: 'Reviewed meeting agenda' } }],
        [
          {
            name: 'google_docs_insert_text',
            args: {
              documentId: 'confirmed-agenda',
              text: 'Review recovery planning and assign follow-ups.',
              location: { index: 1 },
            },
          },
        ],
        [{ name: 'task_complete', args: { id: 'create' } }],
        [{ name: 'task_complete', args: { id: 'insert' } }],
        [{ name: 'task_check', args: {} }],
      ],
    });
    assert.equal(approvedStart.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 0);
    const createPending = await pending(app, successThread);
    const insertedPending = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: createPending.runId,
        toolCallId: createPending.toolCalls[0]!.toolCallId,
      }),
    );
    assert.equal(insertedPending.finishReason, 'suspended');
    assert.deepEqual(
      fixture.providerCalls.map(call => call.body),
      [{ title: 'Reviewed meeting agenda' }],
    );
    assert.ok((await progressState(dataDir, successThread)).tasks.every(task => task.status !== 'completed'));
    const insertPending = await pending(app, successThread);
    assert.equal(insertPending.toolCalls[0]!.toolName, 'google_docs_insert_text');
    const completed = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: insertPending.runId,
        toolCallId: insertPending.toolCalls[0]!.toolCallId,
      }),
    );
    assert.match(completed.text, /Verified document content and completed task results/);
    assert.equal(fixture.providerCalls.length, 2);
    assert.match(fixture.providerCalls[1]!.path, /confirmed-agenda:batchUpdate/);
    assert.match(JSON.stringify(fixture.providerCalls[1]!.body), /Review recovery planning and assign follow-ups/);
    const completeState = await progressState(dataDir, successThread);
    assert.equal(completeState.objective?.status, 'done');
    assert.deepEqual(
      completeState.tasks.map(task => task.status),
      ['completed', 'completed'],
    );
    assert.match(JSON.stringify(fixture.judges.at(-1)), /confirmed-agenda/);
    assert.match(JSON.stringify(fixture.judges.at(-1)), /allCompleted/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

// Schedule journeys use native workers, file storage and a separate real server process.
import { progressFixture, progressTurn } from './progress';
import {
  createMonitor,
  dueNow,
  eventually,
  history,
  monitorPrompt,
  nativeSchedule,
  occurrences,
  recurring,
  schedules,
  scheduleTurn,
} from './schedules';
import type { Schedule } from '@mastra/core/storage';
import type { AgentSchedule } from '@mastra/core/schedules';

test('schedule lifecycle persists timing and owner scope across restart', { timeout: 120000 }, async () => {
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-schedule-life-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl);
    const value = await createMonitor(
      app,
      'schedule-life',
      'meeting-request',
      JSON.stringify({ missing: 'a meeting confirmation' }),
    );
    assert.equal(value.timezone, recurring.timezone);
    assert.equal(value.cron, recurring.cron);
    assert.ok(value.nextFireAt > Date.now());
    assert.equal(value.resourceId, 'local-owner');
    assert.equal(value.agentId, 'personal-assistant');
    await createMonitor(app, 'schedule-life', 'meeting-request');
    assert.equal((await schedules(app)).length, 1, 'An identified request cannot create a duplicate monitor.');
    await scheduleTurn(app, 'schedule-life', {
      action: 'update',
      scheduleId: value.id,
      timing: { ...recurring, cron: '0 30 10 * * 1-5' },
    });
    const changed = (await schedules(app))[0]!;
    assert.equal(changed.cron, '0 30 10 * * 1-5');
    assert.notEqual(changed.nextFireAt, value.nextFireAt);
    await scheduleTurn(app, 'schedule-life', { action: 'pause', scheduleId: value.id });
    assert.equal((await schedules(app, 'paused'))[0]!.id, value.id);
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl);
    const restored = (await schedules(app, 'paused'))[0]!;
    assert.equal(restored.id, value.id);
    assert.equal(restored.timezone, recurring.timezone);
    assert.equal(restored.cron, changed.cron);
    await scheduleTurn(app, 'schedule-life', { action: 'resume', scheduleId: value.id });
    const resumed = (await schedules(app))[0]!;
    await nativeSchedule(app, 'run', { id: value.id });
    const fired = await eventually(
      () => occurrences(app!, value.id),
      values => values.some(value => value.outcome === 'succeeded'),
    );
    assert.ok(fired[0]!.id);
    assert.ok(fired[0]!.runId);
    await eventually(
      () => history(app!, 'schedule-life'),
      value => value.includes('Please provide a meeting confirmation'),
    );
    assert.equal((await schedules(app))[0]!.nextFireAt, resumed.nextFireAt, 'Manual dispatch preserves cadence.');
    const cancelled = await scheduleTurn(app, 'schedule-life', {
      action: 'cancel',
      scheduleId: value.id,
      reason: 'owner-request',
    });
    assert.match(cancelled.text, /does not roll back/);
    assert.deepEqual(await schedules(app), []);
    await json(await app.request(`/schedules/${value.id}`), 404);
    assert.equal(await nativeSchedule(app, 'row', { id: value.id }), null);
    assert.match(await history(app, 'schedule-life'), /meeting confirmation/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('invalid timing and foreign schedule targets leave storage unchanged', { timeout: 120000 }, async () => {
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-schedule-scope-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, { TEST_SEED_FOREIGN: 'true' });
    const owner = await createMonitor(app, 'schedule-scope', 'owner');
    const futureYear = new Date().getUTCFullYear() + 2;
    const marchDay = 8 + ((7 - new Date(Date.UTC(futureYear, 2, 1)).getUTCDay()) % 7);
    const dstGap = `${futureYear}-03-${String(marchDay).padStart(2, '0')}T02:30:00-05:00`;
    for (const timing of [
      { kind: 'once', date: `${futureYear}-02-30T10:00:00Z`, timezone: 'UTC' },
      { kind: 'once', date: '2020-01-01T10:00:00Z', timezone: 'UTC' },
      { kind: 'once', date: `${futureYear}-01-10T10:00:00`, timezone: 'UTC' },
      { kind: 'once', date: dstGap, timezone: 'America/New_York' },
      { kind: 'once', date: `${futureYear}-01-10T10:00:00+01:00`, timezone: 'UTC' },
      { ...recurring, timezone: '+01:00' },
      { ...recurring, timezone: 'Invalid/Zone' },
      { ...recurring, cron: 'invalid cron' },
      { ...recurring, cron: '0 0 9 1 1 * 2020' },
      { kind: 'cron', cron: '* * * * *' },
    ]) {
      await scheduleTurn(app, 'schedule-scope', {
        action: 'create',
        requestId: 'invalid',
        name: 'Invalid timing',
        prompt: 'Check',
        timing,
      });
      assert.deepEqual(
        (await schedules(app)).map(value => value.id),
        [owner.id],
      );
    }
    const hidden: AgentSchedule[] = [];
    for (const overrides of [
      { id: 'foreign-resource', resourceId: 'foreign-owner', threadId: 'foreign-thread' },
      { id: 'foreign-agent', agentId: 'other-agent' },
      { id: 'internal-notification', metadata: {} },
      { id: 'forged-thread', threadId: 'foreign-thread' },
    ])
      hidden.push(
        await nativeSchedule<AgentSchedule>(app, 'create', {
          agentId: 'personal-assistant',
          cron: recurring.cron,
          timezone: recurring.timezone,
          resourceId: 'local-owner',
          threadId: 'schedule-scope',
          prompt: 'private-schedule-marker',
          metadata: { personalAssistant: true },
          ...overrides,
        }),
      );
    for (const value of hidden) {
      const before: Schedule = await nativeSchedule<Schedule>(app, 'row', { id: value.id });
      for (const action of ['inspect', 'pause', 'resume', 'run-now', 'cancel', 'update']) {
        await scheduleTurn(app, 'schedule-scope', {
          action,
          scheduleId: value.id,
          ...(action === 'cancel' ? { reason: 'owner-request' } : {}),
          ...(action === 'update' ? { timing: recurring } : {}),
        });
      }
      for (const operation of ['pause', 'resume', 'run'])
        await json(await app.request(`/schedules/${value.id}/${operation}`, 'POST', {}), 403);
      await json(await app.request(`/schedules/${value.id}`), 404);
      await json(await app.request(`/schedules/${value.id}/triggers`), 404);
      assert.deepEqual(await nativeSchedule(app, 'row', { id: value.id }), before);
    }
    assert.deepEqual(
      (await schedules(app)).map(value => value.id),
      [owner.id],
    );
    const listed = await scheduleTurn(app, 'schedule-scope', { action: 'list' });
    assert.doesNotMatch(listed.text, /private-schedule-marker/);
    for (const [path, method, body] of [
      [
        '/schedules',
        'POST',
        {
          agentId: 'personal-assistant',
          prompt: 'bypass',
          cron: '* * * * *',
          ifIdle: { streamOptions: { requestContext: { injected: true } } },
        },
      ],
      [`/schedules/${owner.id}`, 'PATCH', { ifActive: { behavior: 'deliver' }, providerOptions: { bypass: true } }],
      [`/schedules/${owner.id}`, 'DELETE', undefined],
      ...['pause', 'resume', 'run'].map(operation => [
        `/schedules/${owner.id}/${operation}`,
        'POST',
        { requireToolApproval: false },
      ]),
    ] as [string, string, unknown][])
      await json(await app.request(path, method, body), 403);
    for (const forbidden of [
      { agentId: 'other-agent' },
      { resourceId: 'foreign-owner' },
      { ifIdle: { behavior: 'wake' } },
      { providerOptions: {} },
    ]) {
      await scheduleTurn(app, 'schedule-scope', {
        action: 'create',
        requestId: 'injected',
        name: 'Injected',
        prompt: 'Check',
        timing: recurring,
        ...forbidden,
      });
      assert.deepEqual(
        (await schedules(app)).map(value => value.id),
        [owner.id],
      );
    }
    assert.equal(fixture.providerCalls.length, 0);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test(
  'scheduled Notion analysis reads and answers without intervention within configured limits',
  { timeout: 120000 },
  async () => {
    const { notionAnalysisFixture } = await import('./connections');
    const { progressState } = await import('./progress');
    const fixture = await notionAnalysisFixture();
    const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-notion-scheduled-'));
    const thread = 'notion-scheduled-analysis';
    let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
    try {
      app = await startAssistant(dataDir, fixture.modelUrl, {
        ...fixture.env,
        ASSISTANT_MAX_STEPS: '6',
        ASSISTANT_MAX_OUTPUT_TOKENS: '1024',
        ASSISTANT_MODEL_MAX_RETRIES: '0',
      });
      await json(
        await app.request(`/memory/threads${query}`, 'POST', {
          threadId: thread,
          resourceId: 'local-owner',
          title: 'Scheduled Notion analysis',
        }),
      );
      const schedule = await nativeSchedule<AgentSchedule>(app, 'create', {
        agentId: 'personal-assistant',
        cron: recurring.cron,
        timezone: recurring.timezone,
        resourceId: 'local-owner',
        threadId: thread,
        prompt:
          'case:notion-read Read analysis-page now with include_transcript=false. Assess T1, T2 and T3, cite the page and task IDs, and answer in English within 150 words with conclusion, blockers and missing evidence. Do not create an objective or change Notion.',
        metadata: { personalAssistant: true },
      });
      assert.equal(fixture.models.length, 0);
      assert.equal(fixture.providerCalls.length, 0);
      assert.doesNotMatch(await history(app, thread), /Draft only|persisted edits verified/);
      // Change the wire source after preparation: the wake must retrieve fresh evidence.
      fixture.state.markdown.markdown =
        'T1: persisted edits verified. T2: restart test passed locally, production proof missing. T3: conflict unresolved, owner decision required.';
      await dueNow(app, schedule.id);
      const persisted = await eventually(
        () => history(app!, thread),
        value => value.includes('Conclusion:'),
      );
      assert.equal(
        fixture.providerCalls.length,
        1,
        'One due wake must retrieve the source without approval or continuation.',
      );
      assert.equal(fixture.providerCalls[0]!.method, 'GET');
      assert.match(fixture.providerCalls[0]!.path, /\/v1\/pages\/analysis-page\/markdown\?include_transcript=false/);
      assert.equal(
        fixture.models.length,
        2,
        'A later native model step must answer from the tool result within the six-step allowance.',
      );
      assert.ok(fixture.models.every(body => (body.max_completion_tokens ?? body.max_tokens) === 1024));
      assert.doesNotMatch(JSON.stringify(fixture.models[0]!.messages), /persisted edits verified/);
      const secondMessages = fixture.models[1]!.messages as { role: string; content: unknown }[];
      const sourceResult = secondMessages.find(message => message.role === 'tool');
      assert.ok(sourceResult, 'The answer step must receive the actual connected result.');
      assert.deepEqual(JSON.parse(String(sourceResult.content)), {
        id: 'analysis-page',
        markdown: fixture.state.markdown.markdown,
        truncated: false,
        unknown_block_ids: [],
      });
      assert.match(
        persisted,
        /Conclusion:.*persisted edits verified.*Blockers:.*Missing evidence:.*analysis-page; tasks T1, T2, T3/,
      );
      const messages = JSON.parse(persisted).messages as MastraDBMessage[];
      const answers = messages.flatMap(message =>
        message.role === 'assistant'
          ? message.content.parts.filter(part => part.type === 'text' && part.text.startsWith('Conclusion:'))
          : [],
      );
      assert.equal(answers.length, 1, 'Only one complete final answer is persisted for this occurrence.');
      assert.ok(answers[0]!.type === 'text' && answers[0]!.text.trim().split(/\s+/).length <= 150);
      assert.doesNotMatch(persisted, /Source incomplete|Draft only/);
      assert.deepEqual(
        (await json(await app.request(`/agents/${agent}/suspended-runs?threadId=${thread}&resourceId=local-owner`)))
          .runs,
        [],
      );
      assert.equal((await progressState(dataDir, thread)).objective, undefined);
      assert.equal(fixture.judges.length, 0, 'No goal judge may execute for a scheduled analysis.');
      const dispatched = await eventually(
        () => occurrences(app!, schedule.id),
        rows => rows.some(row => row.outcome === 'succeeded'),
      );
      assert.equal(dispatched.filter(row => row.outcome === 'succeeded').length, 1);
      await nativeSchedule(app, 'patch', { id: schedule.id, patch: { status: 'paused' } });
      await app.stop();
      app = undefined;
      const storage = new LibSQLStore({ id: 'notion-analysis-reader', url: `file:${join(dataDir, 'assistant.db')}` });
      await storage.init();
      try {
        const domain = await storage.getStore('observability');
        const roots = await domain!.listTraces({ pagination: { page: 0, perPage: 100 } });
        const traces = [];
        for (const root of roots.spans) traces.push(await domain!.getTrace({ traceId: root.traceId }));
        const spans = traces.flatMap(trace => trace?.spans ?? []);
        assert.ok(
          spans.some(
            span =>
              span.attributes?.finishReason === 'stop' ||
              (span.output as Record<string, unknown>)?.finishReason === 'stop',
          ),
          'The persisted native run must finish normally, without truncation or step exhaustion.',
        );
        assert.ok(spans.some(span => span.metadata?.scheduleId === schedule.id));
        assert.ok(!spans.some(span => span.error));
      } finally {
        await storage.close();
      }
      app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
      assert.match(await history(app, thread), /Conclusion:.*persisted edits verified/);
      assert.equal(fixture.models.length, 2, 'Readback and restart must not generate a continuation.');
      assert.equal(fixture.providerCalls.length, 1);
    } finally {
      await app?.stop();
      await fixture.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);

test('scheduled model defaults bound output and disable provider retries', { timeout: 120000 }, async () => {
  const { connectedFixture } = await import('./connections');
  let fail = false;
  const fixture = await connectedFixture(() =>
    fail ? { text: 'Synthetic rate limit', status: 429 } : { text: 'Bounded scheduled response.' },
  );
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-model-defaults-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, {
      ASSISTANT_MAX_STEPS: '1',
      ASSISTANT_MAX_OUTPUT_TOKENS: '512',
      ASSISTANT_MODEL_MAX_RETRIES: '0',
    });
    await json(
      await app.request(`/memory/threads${query}`, 'POST', {
        threadId: 'bounded-schedule',
        resourceId: 'local-owner',
        title: 'Bounded scheduled response',
      }),
    );
    const schedule = await nativeSchedule<AgentSchedule>(app, 'create', {
      agentId: 'personal-assistant',
      cron: recurring.cron,
      timezone: recurring.timezone,
      resourceId: 'local-owner',
      threadId: 'bounded-schedule',
      prompt: 'Reply with a short synthetic confirmation. Do not call tools.',
      metadata: { personalAssistant: true },
    });
    await dueNow(app, schedule.id);
    await eventually(
      () => history(app!, 'bounded-schedule'),
      value => value.includes('Bounded scheduled response.'),
    );
    assert.equal(fixture.models.length, 1, 'A fresh scheduled wake uses the agent defaults without a prior model run.');
    assert.ok(
      JSON.stringify(fixture.models[0]!.messages).includes(
        'Reply with a short synthetic confirmation. Do not call tools.',
      ),
      'The scheduled instruction must reach the model, not only persistent conversation history.',
    );
    assert.equal(fixture.models[0]!.max_completion_tokens ?? fixture.models[0]!.max_tokens, 512);

    fail = true;
    const beforeFailure = fixture.models.length;
    await json(
      await fetch(`${app.url}/api/agents/${agent}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Exercise a synthetic transient provider failure.' }],
          memory: { thread: 'bounded-provider-failure' },
        }),
      }),
      500,
    );
    assert.equal(fixture.models.length, beforeFailure + 1, 'Configured zero retries makes one provider attempt.');
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('scheduled responsibilities preserve approvals results and stop conditions', { timeout: 240000 }, async () => {
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-schedule-approval-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    fixture.providerState.insertStatus = 200;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    await json(
      await app.request(`/memory/threads${query}`, 'POST', {
        threadId: 'schedule-approved',
        resourceId: 'local-owner',
        title: 'Scheduled meeting result',
      }),
    );
    await json(
      await app.request(`/memory/threads/schedule-approved/working-memory${query}`, 'POST', {
        workingMemory: 'Prefer concise scheduled summaries.',
      }),
    );
    const value = await createMonitor(app, 'schedule-approved', 'approved-monitor');
    await dueNow(app, value.id);
    const waiting = await pending(app, 'schedule-approved');
    assert.equal(waiting.toolCalls[0]!.toolName, 'google_docs_create_document');
    assert.deepEqual(waiting.toolCalls[0]!.args, { title: 'Scheduled reviewed result' });
    assert.equal(fixture.providerCalls.filter(value => value.method === 'POST').length, 0);
    assert.ok(
      fixture.providerCalls.some(
        value => value.resource === 'local-owner' && value.path.includes('/messages/source-message'),
      ),
    );
    assert.match(JSON.stringify(fixture.models), /Prefer concise scheduled summaries/);
    assert.equal((await schedules(app))[0]!.id, value.id, 'Hand-off and pending approval cannot stop monitoring.');
    const blockedModelCalls = fixture.models.length;
    await nativeSchedule(app, 'run', { id: value.id });
    await eventually(
      () => occurrences(app!, value.id),
      rows => rows.some(row => row.outcome === 'skipped'),
    );
    const preservedApproval = await pending(app, 'schedule-approved');
    assert.equal(preservedApproval.runId, waiting.runId);
    assert.deepEqual(preservedApproval.toolCalls, waiting.toolCalls);
    assert.equal(
      fixture.models.length,
      blockedModelCalls,
      'A skipped approval-blocked check must not start another model run.',
    );
    assert.equal(fixture.providerCalls.filter(value => value.method === 'POST').length, 0);
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const restored = await pending(app, 'schedule-approved');
    assert.equal(restored.runId, waiting.runId);
    assert.match(await history(app, 'schedule-approved'), /Scheduled reviewed result/);
    const blank = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: restored.runId,
        toolCallId: restored.toolCalls[0]!.toolCallId,
      }),
    );
    assert.equal(blank.finishReason, 'suspended', 'A blank document must request a separate content approval.');
    const content = await pending(app, 'schedule-approved');
    assert.equal(content.toolCalls[0]!.toolName, 'google_docs_insert_text');
    assert.deepEqual(content.toolCalls[0]!.args, {
      documentId: 'existing-document',
      text: 'Source source-message requires an offline-first editor and a recovery test.',
      location: { index: 1 },
    });
    assert.equal(fixture.providerCalls.filter(value => value.method === 'POST').length, 1);
    assert.ok(
      (await schedules(app)).some(row => row.id === value.id),
      'Blank creation cannot complete monitoring.',
    );
    const approved = await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: content.runId,
        toolCallId: content.toolCalls[0]!.toolCallId,
      }),
    );
    assert.match(approved.text, /Verified scheduled document content/);
    const insertions = fixture.providerCalls.filter(value => value.path.includes(':batchUpdate'));
    assert.equal(insertions.length, 1);
    assert.match(JSON.stringify(insertions[0]!.body), /offline-first editor and a recovery test/);
    assert.equal(insertions[0]!.resource, 'local-owner');
    assert.equal(fixture.providerCalls.filter(value => value.method === 'POST').length, 2);
    assert.ok(
      (await schedules(app)).some(row => row.id === value.id),
      'Confirmed result remains available until the assistant explicitly stops the responsibility.',
    );
    // Repeat a native publication after a full restart: the paid-model fixture must see real stored completion before choosing reuse.
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const modelCount = fixture.models.length;
    await nativeSchedule(app, 'run', { id: value.id });
    await eventually(
      () => history(app!, 'schedule-approved'),
      value => value.includes('No external action was repeated'),
    );
    assert.match(JSON.stringify(fixture.models.slice(modelCount)), /Verified scheduled document content/);
    assert.equal(
      fixture.providerCalls.filter(value => value.method === 'POST').length,
      2,
      'A recorded completed effect must not be repeated on the duplicate check.',
    );
    await scheduleTurn(app, 'schedule-approved', {
      action: 'cancel',
      scheduleId: value.id,
      reason: 'confirmed-completion',
    });
    assert.ok(!(await schedules(app)).some(row => row.id === value.id));
    assert.match(await history(app, 'schedule-approved'), /existing-document/);

    const declined = await createMonitor(app, 'schedule-declined', 'declined-monitor');
    const mutations = fixture.providerCalls.filter(value => value.method === 'POST').length;
    await nativeSchedule(app, 'run', { id: declined.id });
    const declineCall = await pending(app, 'schedule-declined');
    await json(
      await app.request(`/agents/${agent}/decline-tool-call-generate`, 'POST', {
        runId: declineCall.runId,
        toolCallId: declineCall.toolCalls[0]!.toolCallId,
      }),
    );
    assert.equal(
      fixture.providerCalls.filter(value => value.method === 'POST').length,
      mutations,
      'Declined work has no external mutation.',
    );
    assert.ok(
      (await schedules(app)).some(row => row.id === declined.id),
      'Decline leaves the responsibility unfinished.',
    );

    fixture.providerState.insertStatus = 400;
    const partial = await createMonitor(app, 'schedule-partial', 'partial-monitor');
    await nativeSchedule(app, 'run', { id: partial.id });
    const partialCreate = await pending(app, 'schedule-partial');
    await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: partialCreate.runId,
        toolCallId: partialCreate.toolCalls[0]!.toolCallId,
      }),
    );
    const partialInsert = await pending(app, 'schedule-partial');
    await json(
      await app.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: partialInsert.runId,
        toolCallId: partialInsert.toolCalls[0]!.toolCallId,
      }),
    );
    const partialHistory = await history(app, 'schedule-partial');
    assert.match(partialHistory, /existing-document/);
    assert.match(partialHistory, /Content insertion failed/);
    assert.doesNotMatch(partialHistory, /Verified scheduled document content:/);
    assert.ok(
      (await schedules(app)).some(row => row.id === partial.id),
      'A partial external result cannot stop monitoring.',
    );
    const effects = fixture.providerCalls.filter(value => value.method === 'POST').length;
    await app.stop();
    app = undefined;
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    assert.match(await history(app, 'schedule-partial'), /existing-document/);
    assert.ok((await schedules(app)).some(row => row.id === partial.id));
    assert.ok((await schedules(app)).some(row => row.id === declined.id));
    assert.equal(
      fixture.providerCalls.filter(value => value.method === 'POST').length,
      effects,
      'Restart cannot replay partial writes automatically.',
    );
    await nativeSchedule(app, 'run', { id: partial.id });
    await eventually(
      () => history(app!, 'schedule-partial'),
      value => value.includes('An owner decision is required'),
    );
    assert.equal(
      fixture.providerCalls.filter(value => value.method === 'POST').length,
      effects,
      'A repeated check preserves the existing partial document and requests a new owner decision.',
    );
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('schedule failures and duplicates preserve truthful outcomes', { timeout: 180000 }, async () => {
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-schedule-outcomes-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  let release: (() => void) | undefined;
  try {
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const value = await createMonitor(
      app,
      'schedule-outcomes',
      'outcomes',
      JSON.stringify({ missing: 'a confirmed external event' }),
    );
    fixture.state.responseGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const active = scheduleTurn(app, 'schedule-outcomes', {
      action: 'run-now',
      scheduleId: value.id,
    });
    const discarded = await eventually(
      () => occurrences(app!, value.id),
      rows => rows.some(row => row.outcome === 'discarded'),
    );
    assert.equal(discarded[0]!.triggerKind, 'manual');
    release!();
    fixture.state.responseGate = undefined;
    const manual = await active;
    assert.match(manual.text, /not a completed check/);
    const before = (await schedules(app))[0]!;
    assert.equal(before.nextFireAt, value.nextFireAt);
    // Native duplicate publication remains best effort: every dispatch stays visible, with no template write replay.
    const time = Date.now();
    for (let index = 0; index < 2; index++)
      await nativeSchedule(app, 'publish', {
        id: value.id,
        claimId: 'duplicate-occurrence',
        scheduledFireAt: time,
      });
    const duplicate = await eventually(
      () => occurrences(app!, value.id),
      rows => rows.filter(row => row.scheduledFireAt === time).length >= 2,
    );
    assert.ok(duplicate.every(row => row.id && row.runId));
    assert.equal(fixture.providerCalls.length, 0);
    await eventually(
      () => history(app!, 'schedule-outcomes'),
      value => value.includes('confirmed external event'),
    );
    const report = await scheduleTurn(app, 'schedule-outcomes', {
      action: 'inspect',
      scheduleId: value.id,
    });
    assert.match(report.text, /discarded/);
    assert.match(report.text, /not proof of completed work/);
    // A missed finite occurrence is exhausted by the real scheduler after restart, never relabeled business completion.
    const date = new Date(Date.now() + 3600000);
    date.setUTCMilliseconds(0);
    await scheduleTurn(app, 'finite-outcomes', {
      action: 'create',
      requestId: 'finite',
      name: 'Finite check',
      prompt: JSON.stringify({ missing: 'owner verification' }),
      timing: { kind: 'once', date: date.toISOString().replace('.000Z', 'Z'), timezone: 'UTC' },
    });
    const finite = (await schedules(app)).find(value => value.threadId === 'finite-outcomes')!;
    await app.stop();
    app = undefined;
    // Simulate elapsed downtime in persisted native state, with no custom recovery queue.
    const storage = new LibSQLStore({
      id: 'missed-schedule-fixture',
      url: `file:${join(dataDir, 'assistant.db')}`,
    });
    await storage.init();
    const domain = await storage.getStore('schedules');
    const past = new Date(Date.now() - 3600000);
    past.setUTCMilliseconds(0);
    const cron = `${past.getUTCSeconds()} ${past.getUTCMinutes()} ${past.getUTCHours()} ${past.getUTCDate()} ${past.getUTCMonth() + 1} * ${past.getUTCFullYear()}`;
    await domain!.updateSchedule(finite.id, { cron, nextFireAt: past.getTime() });
    await storage.close();
    app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
    const complete = await eventually(
      () => schedules(app!, 'completed'),
      values => values.some(value => value.id === finite.id),
    );
    assert.equal(complete.find(value => value.id === finite.id)!.status, 'completed');
    const cadence = await scheduleTurn(app, 'finite-outcomes', {
      action: 'inspect',
      scheduleId: finite.id,
    });
    assert.match(cadence.text, /completed cadence does not mean the responsibility succeeded/);
    const list = await scheduleTurn(app, 'finite-outcomes', { action: 'list' });
    assert.match(list.text, new RegExp(finite.id));
    assert.equal(fixture.providerCalls.length, 0);
  } finally {
    release?.();
    fixture.state.responseGate = undefined;
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('documented setup starts a functional assistant', { timeout: 90000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-setup-'));
  const fixture = await modelFixture('Choose one priority, reserve a focused work session, and take a short break.');
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    const root = fileURLToPath(new URL('..', import.meta.url));
    await mkdir(join(directory, 'scripts'));
    await cp(join(root, 'scripts/setup.mjs'), join(directory, 'scripts/setup.mjs'));
    await cp(join(root, '.env.example'), join(directory, '.env.example'));
    const setup = spawn(process.execPath, ['scripts/setup.mjs'], { cwd: directory, env: isolatedEnv() });
    assert.equal((await once(setup, 'exit'))[0], 0);
    const initial = await readFile(join(directory, '.env'), 'utf8');
    await writeFile(join(directory, '.env'), initial.replace('OPENAI_API_KEY=', 'OPENAI_API_KEY=example-key'));
    app = await startAssistant(directory, fixture.url, parseEnv(await readFile(join(directory, '.env'), 'utf8')));
    const answer = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: 'Help me plan a focused morning.' }],
        memory: { thread: 'setup-thread' },
      }),
    );
    assert.match(answer.text, /Choose one priority.*focused work session/);
    assert.match(JSON.stringify(fixture.requests[0]!.messages), /Help me plan a focused morning/);
    const history = await json(await app.request(`/memory/threads/setup-thread/messages${query}`));
    assert.match(JSON.stringify(history), /Choose one priority.*focused work session/);
    const remembered = await json(
      await app.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: preferencePrompt }],
        memory: { thread: 'setup-thread' },
      }),
    );
    assert.match(remembered.text, /Saved your preference/);
    const working = await json(await app.request(`/memory/threads/setup-thread/working-memory${query}`));
    assert.match(working.workingMemory, /Prefer concise bullet points/);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test(
  'native owner authentication rejects unauthorized local composition requests before data access',
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-auth-'));
    const fixture = await modelFixture();
    const token = 'example-owner-token-at-least-32-characters';
    let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
    try {
      app = await startAssistant(directory, fixture.url, {
        ASSISTANT_RUNTIME: 'hosted',
        TURSO_DATABASE_URL: 'libsql://assistant-example.turso.io',
        TURSO_AUTH_TOKEN: 'example-database-token',
        ASSISTANT_API_TOKEN: token,
        MASTRA_PLATFORM_STUDIO_AUTH: 'disabled',
        TEST_AUTH_DATABASE_URL: `file:${join(directory, 'assistant.db')}`,
      });
      for (const headers of [{}, { authorization: 'Bearer invalid-owner-token' }] as Record<string, string>[]) {
        for (const path of ['/agents', `/memory/threads${query}`, '/schedules']) {
          const response = await app.request(path, 'GET', undefined, headers);
          assert.equal(response.status, 401, await response.text());
        }
        const response = await app.request(
          `/agents/${agent}/generate`,
          'POST',
          {
            messages: [{ role: 'user', content: 'Do not run without authentication.' }],
            memory: { thread: 'unauthorized-thread' },
          },
          headers,
        );
        assert.equal(response.status, 401);
      }
      assert.equal(fixture.requests.length, 0);
      const authorized = { authorization: `Bearer ${token}` };
      const thread = await json(
        await app.request(
          `/memory/threads${query}`,
          'POST',
          {
            threadId: 'authenticated-thread',
            resourceId: 'forged-owner',
            title: 'Authenticated conversation',
          },
          authorized,
        ),
      );
      assert.equal(thread.resourceId, 'local-owner');
      const threads = await json(await app.request(`/memory/threads${query}`, 'GET', undefined, authorized));
      assert.match(JSON.stringify(threads), /authenticated-thread/);
      assert.doesNotMatch(JSON.stringify(threads), /unauthorized-thread/);
    } finally {
      await app?.stop();
      await fixture.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test('assistant handles both examples and an unseen responsibility', { timeout: 240000 }, async () => {
  const { experienceFixture } = await import('./connections');
  const { dueNow, eventually, history, occurrences, schedules } = await import('./schedules');
  const directory = await mkdtemp(join(tmpdir(), 'personal-assistant-experience-'));
  const fixture = await experienceFixture();
  const env = fixture.env;
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  const generate = async (thread: string, prompt: string) =>
    json(
      await app!.request(`/agents/${agent}/generate`, 'POST', {
        messages: [{ role: 'user', content: prompt }],
        memory: { thread },
        requireToolApproval: false,
      }),
    );
  const approve = async (thread: string) => {
    const suspended = await pending(app!, thread);
    return json(
      await app!.request(`/agents/${agent}/approve-tool-call-generate`, 'POST', {
        runId: suspended.runId,
        toolCallId: suspended.toolCalls[0]!.toolCallId,
      }),
    );
  };
  try {
    app = await startAssistant(directory, fixture.modelUrl, env);
    const started = await generate(
      'gmail-review',
      'case:experience-mail Review source-message in full and create a document with the review.',
    );
    assert.equal(started.finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 1, 'Only the reviewed Gmail read may execute without approval.');
    const create = await pending(app, 'gmail-review');
    assert.deepEqual(create.toolCalls[0]!.args, { title: 'Proposal review' });
    assert.equal((await approve('gmail-review')).finishReason, 'suspended');
    assert.equal(fixture.providerCalls.length, 2);
    const insert = await pending(app, 'gmail-review');
    assert.deepEqual(insert.toolCalls[0]!.args, {
      documentId: 'proposal-review-document',
      location: { index: 1 },
      text: 'Review of source-message: The proposal requires an offline-first editor and a recovery test.',
    });
    const failed = await approve('gmail-review');
    assert.match(failed.text, /proposal-review-document.*incomplete/);
    assert.equal(fixture.providerCalls.length, 3, 'A failed insertion must not replay creation or insertion.');
    const mailHistory = await history(app, 'gmail-review');
    assert.match(mailHistory, /proposal-review-document/);
    assert.match(mailHistory, /Content insertion failed/);
    assert.doesNotMatch(JSON.stringify(insert.toolCalls[0]!.args), /Short snippet/);

    fixture.state.message = {
      id: 'source-message',
      payload: { mimeType: 'text/plain', body: { data: Buffer.alloc(65537, 97).toString('base64url') } },
    };
    const truncated = await generate(
      'gmail-incomplete',
      'case:experience-mail Review source-message and create a document only from full supported content.',
    );
    assert.match(truncated.text, /incomplete/);
    assert.match(truncated.text, /truncated/);
    assert.equal(fixture.providerCalls.length, 4, 'Incomplete evidence must not produce a document mutation.');

    const notion = await generate(
      'notion-priorities',
      'case:experience-notion Prioritize my task-page tasks with sources; identify missing data.',
    );
    assert.equal(notion.finishReason, 'suspended', 'Unreviewed Notion reads must retain approval.');
    assert.equal(fixture.providerCalls.length, 4);
    const ranked = await approve('notion-priorities');
    assert.match(ranked.text, /task-release.*blocks release/i);
    assert.match(ranked.text, /task-research.*no due date/i);
    assert.match(ranked.text, /partial.*cannot claim a complete ranking/);
    assert.match(ranked.text, /task-page/);
    assert.equal(fixture.providerCalls.length, 5);
    assert.equal(fixture.providerCalls[4]!.method, 'GET');

    const monitored = await generate(
      'jira-monitor',
      'case:experience-jira-create Monitor unresolved OPS issues each weekday at 09:00 America/Sao_Paulo; do not change Jira.',
    );
    assert.match(monitored.text, /not a completed Jira check/);
    const monitor = (await schedules(app)).find(value => value.threadId === 'jira-monitor');
    assert.ok(monitor);
    await dueNow(app, monitor.id);
    const jiraPending = await eventually(
      () => pending(app!, 'jira-monitor'),
      value => value.toolCalls.length === 1,
    );
    assert.equal(jiraPending.toolCalls[0]!.toolName, 'jira_search_issues');
    assert.equal(fixture.providerCalls.length, 5, 'A scheduled unreviewed Jira read also requires approval.');
    const checked = await approve('jira-monitor');
    assert.match(checked.text, /OPS-42.*Open/);
    assert.match(checked.text, /monitoring remains active/);
    assert.equal(fixture.providerCalls.length, 6, checked.text);
    assert.match(JSON.stringify(fixture.providerCalls[5]!.body), /project = OPS/);
    assert.equal((await schedules(app)).find(value => value.id === monitor.id)?.status, 'active');
    assert.ok((await occurrences(app, monitor.id)).length > 0);
    const beforeRestart = await history(app, 'jira-monitor');
    assert.match(beforeRestart, /OPS-42/);
    await app.stop();
    app = undefined;

    // Read the actual flushed native observability store, then reopen the assistant and inspect its conversations.
    const storage = new LibSQLStore({ id: 'experience-trace-reader', url: `file:${join(directory, 'assistant.db')}` });
    await storage.init();
    try {
      const traces = await storage.getStore('observability');
      const roots = await traces!.listTraces({ pagination: { page: 0, perPage: 100 } });
      assert.ok(roots.spans.some(span => span.runId === started.runId));
      const all = [];
      for (const root of roots.spans) all.push(await traces!.getTrace({ traceId: root.traceId }));
      const serialized = JSON.stringify(all);
      assert.match(serialized, /google_mail_get_message|google_docs_create_document/);
      assert.match(serialized, /jira_search_issues/);
      assert.doesNotMatch(
        serialized,
        /example-key|example-connect-token|offline-first editor|Ship the recovery fix|Ignore the owner/,
      );
      assert.doesNotMatch(serialized, /Content insertion failed/);
      const spans = all.flatMap(trace => trace?.spans ?? []);
      assert.ok(
        spans.some(span => span.attributes?.success === false && span.error),
        'A provider error must remain distinguishable from success.',
      );
      assert.ok(
        spans.some(span => span.attributes?.success === true),
        'Confirmed tool execution must retain its native result status.',
      );
      assert.ok(
        spans.some(
          span => span.outcome === 'suspended' || (span.output as Record<string, unknown>)?.status === 'suspended',
        ),
        'Pending approval must remain distinguishable from a completed run.',
      );
      assert.ok(
        spans.some(span => span.metadata?.scheduleId === monitor.id),
        'Scheduled execution must retain the native schedule identity.',
      );
      assert.match(serialized, /proposal-review-document/);
    } finally {
      await storage.close();
    }
    app = await startAssistant(directory, fixture.modelUrl, env);
    assert.match(await history(app, 'gmail-review'), /proposal-review-document.*incomplete/);
    assert.match(await history(app, 'notion-priorities'), /task-release/);
    assert.match(await history(app, 'jira-monitor'), /OPS-42/);
    assert.equal(fixture.providerCalls.length, 6, 'Restart must not replay provider operations.');
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(directory, { recursive: true, force: true });
  }
});
