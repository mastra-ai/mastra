import { LibSQLStore } from '@mastra/libsql';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { loadConfig } from '../src/mastra/config';
import { createAssistant } from '../src/mastra/runtime';
import { isolatedEnv, json, modelFixture, pending, readState, startAssistant } from './helpers';

const agent = 'personalAssistant';
const query = `?agentId=${agent}`;
const preferencePrompt = 'Please remember: Prefer concise bullet points. private-turn-marker';

test('direct tool execution routes cannot bypass native approval', { timeout: 120000 }, async () => {
  const { connectedFixture } = await import('./connections');
  for (const mode of ['hosted', 'local']) {
    const fixture = await connectedFixture();
    const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-direct-tools-'));
    const token = 'example-owner-token-at-least-32-characters';
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
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
      /** Exercise direct execution through real HTTP with the current owner credentials. */
      const send = (path: string, body: BodyInit, contentType?: string) =>
        fetch(`${app!.url}/api${path}`, {
          method: 'POST',
          headers: { ...headers, ...(contentType ? { 'content-type': contentType } : {}) },
          body,
        });
      /** Construct multipart fields in their native duplicate-field order for route protection probes. */
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
      const native = await json(
        await fetch(abortUrl, { ...options, headers: { ...app.headers, ...options.headers } }),
        501,
      );
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
        headers: app.headers,
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
    for (const route of ['generate', 'stream', 'stream-until-idle', 'send-message', 'send-tool-approval']) {
      for (const query of ['maxSteps=20', 'maxSteps=1&maxSteps=20', 'streamOptions[maxSteps]=20', 'hooks={}']) {
        const denied = await json(
          await app.request(`/agents/${agent}/${route}?${query}`, 'POST', {
            messages: [{ role: 'user', content: 'Do not start an unbounded run.' }],
            memory: { thread: 'owner-thread' },
          }),
          400,
        );
        assert.match(denied.error, /query/i);
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
        headers: app.headers,
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
      { headers: { ...app.headers, 'x-resource-id': 'foreign-owner' } },
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

test(
  'local API rejects cross-site multipart runs and schedule creation without credentials',
  { timeout: 30000 },
  async () => {
    const { progressFixture } = await import('./progress');
    const fixture = await progressFixture();
    const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-local-auth-'));
    let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
    try {
      app = await startAssistant(dataDir, fixture.modelUrl, fixture.env);
      for (const route of ['generate', 'stream', 'send-message']) {
        const form = new FormData();
        form.set(
          'messages',
          JSON.stringify([
            {
              role: 'user',
              content: JSON.stringify({
                calls: [
                  [
                    {
                      name: 'schedule',
                      args: {
                        action: 'create',
                        requestId: 'cross-site',
                        name: 'Unauthorized work',
                        prompt: 'Run repeatedly.',
                        timing: { kind: 'cron', cron: '* * * * *', timezone: 'UTC' },
                      },
                    },
                  ],
                ],
              }),
            },
          ]),
        );
        form.set('memory', JSON.stringify({ thread: 'cross-site' }));
        form.set('threadId', 'cross-site');
        form.set('resourceId', 'local-owner');
        form.set('message', 'Start work.');
        const response: Response = await fetch(`${app.url}/api/agents/${agent}/${route}`, {
          method: 'POST',
          body: form,
          headers: { origin: 'https://attacker.example', 'sec-fetch-site': 'cross-site' },
        });
        assert.equal(response.status, 401);
      }
      assert.equal(
        (await fetch(`${app.url}/api/schedules`, { method: 'POST', headers: { origin: 'null' } })).status,
        401,
      );
      assert.equal((await fetch(`${app.url}/api/agents`)).status, 401);
      assert.equal(fixture.models.length, 0);
      assert.deepEqual((await json(await app.request('/schedules'))).schedules, []);
    } finally {
      await app?.stop();
      await fixture.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  },
);

test('model reservations bound repeated calls tokens output and concurrent work', { timeout: 60000 }, async () => {
  const { progressFixture } = await import('./progress');
  const fixture = await progressFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-model-capacity-'));
  let native: ReturnType<typeof createAssistant> | undefined;
  let release: (() => void) | undefined;
  const selection = { id: 'openai/gpt-6-luna' as const, url: fixture.modelUrl, apiKey: 'example' };
  try {
    const config = loadConfig({
      OPENAI_API_KEY: 'example',
      ASSISTANT_DATA_DIR: dataDir,
      ASSISTANT_MAX_MODEL_CALLS_PER_HOUR: '2',
      ASSISTANT_MAX_OUTPUT_TOKENS: '32',
      ASSISTANT_MODEL_MAX_RETRIES: '0',
    });
    native = createAssistant(config, selection, { ...selection, url: `${fixture.modelUrl}/judge` });
    const assistant = native.getAgent(agent);
    await assistant.generate('A short answer.', {
      modelSettings: { maxOutputTokens: 999 },
      memory: { thread: 'call-cap', resource: 'local-owner' },
    });
    assert.equal(fixture.models.at(-1)!.max_tokens, 32);
    await assistant.generate('One more.', { memory: { thread: 'call-cap', resource: 'local-owner' } });
    const boundary = fixture.models.length;
    await assert.rejects(
      assistant.generate('Capacity is exhausted.', { memory: { thread: 'call-cap', resource: 'local-owner' } }),
      /capacity exhausted/,
    );
    assert.equal(fixture.models.length, boundary);
    await native.shutdown();
    native = createAssistant(
      loadConfig({
        OPENAI_API_KEY: 'example',
        ASSISTANT_DATA_DIR: dataDir,
        ASSISTANT_MAX_MODEL_TOKENS_PER_HOUR: '1',
        ASSISTANT_MODEL_MAX_RETRIES: '0',
      }),
      selection,
    );
    await assert.rejects(
      native
        .getAgent(agent)
        .generate('Do not dispatch over budget.', { memory: { thread: 'tokens-cap', resource: 'local-owner' } }),
      /capacity exhausted/,
    );
    assert.equal(fixture.models.length, boundary);
    await native.shutdown();
    native = createAssistant(
      loadConfig({
        OPENAI_API_KEY: 'example',
        ASSISTANT_DATA_DIR: dataDir,
        ASSISTANT_MAX_CONCURRENT_MODELS: '1',
        ASSISTANT_MODEL_MAX_RETRIES: '0',
      }),
      selection,
    );
    fixture.state.responseGate = new Promise<void>(resolve => {
      release = resolve;
    });
    const first = native
      .getAgent(agent)
      .generate('Hold this answer.', { memory: { thread: 'concurrent-first', resource: 'local-owner' } });
    for (let attempt = 0; attempt < 200 && fixture.models.length === boundary; attempt++) await delay(10);
    assert.equal(fixture.models.length, boundary + 1);
    await assert.rejects(
      native
        .getAgent(agent)
        .generate('Reject concurrent work.', { memory: { thread: 'concurrent-second', resource: 'local-owner' } }),
      /capacity exhausted/,
    );
    assert.equal(fixture.models.length, boundary + 1);
    release!();
    await first;
    fixture.state.responseGate = undefined;
    await native
      .getAgent(agent)
      .generate('Capacity was released.', { memory: { thread: 'concurrent-second', resource: 'local-owner' } });
    assert.equal(fixture.models.length, boundary + 2);
  } finally {
    release?.();
    await native?.shutdown();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('HTTP request limits reject repeated requests before model dispatch', { timeout: 30000 }, async () => {
  const fixture = await modelFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-request-capacity-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.url, { ASSISTANT_MAX_REQUESTS_PER_MINUTE: '2' });
    await json(await app.request('/agents'));
    await json(await app.request('/agents'));
    const denied = await app.request(`/agents/${agent}/generate`, 'POST', { messages: 'Do not start.' });
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('retry-after'), '60');
    assert.equal(fixture.requests.length, 0);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('HTTP model overrides cannot bypass shared execution limits', { timeout: 30000 }, async () => {
  const fixture = await modelFixture();
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-model-overrides-'));
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, fixture.url);
    const model = 'invalid-review-model';
    for (const mode of ['generate', 'stream', 'send-message', 'send-tool-approval', 'approve-tool-call-generate']) {
      for (const options of [
        { model },
        { streamOptions: { model } },
        { ifIdle: { behavior: 'wake', streamOptions: { model } } },
        { structuredOutput: { schema: {}, model } },
        { memory: { thread: 'alternate-title', options: { generateTitle: { model } } } },
        { memoryConfig: { generateTitle: { model } } },
      ]) {
        const denied = await app.request(`/agents/${agent}/${mode}`, 'POST', { messages: 'No dispatch.', ...options });
        assert.equal(denied.status, 400);
        assert.match(await denied.text(), /overrides/);
      }
      assert.equal(
        (await app.request(`/agents/${agent}/${mode}?model=${model}`, 'POST', { messages: 'No dispatch.' })).status,
        400,
      );
      const form = new FormData();
      form.set('messages', '"No dispatch."');
      form.set('model', JSON.stringify(model));
      assert.equal(
        (await fetch(`${app.url}/api/agents/${agent}/${mode}`, { method: 'POST', headers: app.headers, body: form }))
          .status,
        400,
      );
    }
    for (const route of ['model', 'model/reset', 'models/reorder', 'models/default'])
      assert.equal((await app.request(`/agents/${agent}/${route}`, 'POST', { model })).status, 403);
    assert.equal(fixture.requests.length, 0);
  } finally {
    await app?.stop();
    await fixture.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test(
  'unauthenticated traffic preserves the owner bearer and Studio request allowance',
  { timeout: 90000 },
  async () => {
    for (const mode of ['local', 'hosted']) {
      for (const ownerAccess of ['bearer', 'cookie']) {
        const fixture = await modelFixture();
        const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-authenticated-capacity-'));
        let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
        const token = 'example-owner-token-at-least-32-characters';
        try {
          app = await startAssistant(dataDir, fixture.url, {
            ASSISTANT_MAX_REQUESTS_PER_MINUTE: '3',
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
          let cookie: string | undefined;
          if (ownerAccess === 'cookie') {
            const signedIn = await fetch(`${app.url}/api/auth/credentials/sign-in`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', origin: app.url, 'sec-fetch-site': 'same-origin' },
              body: JSON.stringify({ email: 'owner@example.test', password: token }),
            });
            assert.equal(signedIn.status, 200);
            cookie = signedIn.headers.get('set-cookie')!.split(';')[0]!;
            assert.ok(cookie.startsWith('mastra-token='));
          }
          for (let attempt = 0; attempt < 3; attempt++)
            assert.equal(
              (await app.request('/agents', 'GET', undefined, { authorization: 'Bearer wrong' })).status,
              401,
            );
          const credentials = cookie ? { cookie } : app.headers;
          assert.equal(
            (await app.request('/agents', 'GET', undefined, credentials)).status,
            200,
            `${mode} ${ownerAccess}: unauthenticated traffic must not lock out the owner.`,
          );
          for (const invalid of [{}, { cookie: 'mastra-token=wrong' }, { 'x-playground-access': 'wrong' }] as Record<
            string,
            string
          >[])
            assert.equal((await app.request('/agents', 'GET', undefined, invalid)).status, 401);
          assert.equal((await app.request('/agents?apiKey=wrong', 'GET', undefined, {})).status, 401);
          if (mode === 'local' && cookie) {
            const denied = await app.request(
              `/memory/threads?agentId=${agent}`,
              'POST',
              { threadId: 'forged-studio' },
              {
                cookie,
                authorization: 'Bearer wrong',
                origin: 'https://attacker.example',
                'sec-fetch-site': 'cross-site',
              },
            );
            assert.equal(denied.status, 401, 'An invalid bearer must not exempt an ambient cookie from CSRF checks.');
          }
          assert.equal((await app.request('/agents', 'GET', undefined, { 'x-playground-access': token })).status, 200);
          assert.equal((await app.request(`/agents?apiKey=${token}`, 'GET', undefined, {})).status, 200);
          const exhausted = await app.request(
            '/agents',
            'GET',
            undefined,
            cookie ? { cookie, authorization: 'Bearer wrong' } : credentials,
          );
          assert.equal(exhausted.status, 429, 'All native owner credentials share the same authenticated allowance.');
          assert.equal(exhausted.headers.get('retry-after'), '60');
          assert.equal(fixture.requests.length, 0);
        } finally {
          await app?.stop();
          await fixture.close();
          await rm(dataDir, { recursive: true, force: true });
        }
      }
    }
  },
);
