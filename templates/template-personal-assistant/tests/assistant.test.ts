import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createAssistant } from '../src/mastra/assistant';
import { loadConfig } from '../src/mastra/config';
import { json, modelFixture, startAssistant } from './helpers';

const agent = 'personalAssistant';
const query = `?agentId=${agent}`;
const preferencePrompt = 'Please remember: Prefer concise bullet points. private-turn-marker';

test('ordinary execution limits protect native message and approval options', { timeout: 90000 }, async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'personal-assistant-bounds-'));
  const model = await modelFixture();
  let app: Awaited<ReturnType<typeof startAssistant>> | undefined;
  try {
    app = await startAssistant(dataDir, model.url, { ASSISTANT_MAX_STEPS: '1', TEST_SEED_FOREIGN: 'true' });
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
      await fetch(`${app.url}/api/agents/${agent}/send-message`, { method: 'POST', body: multipart }),
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
      ['signals', maxSteps => ({ ...target, signal, ifIdle: { behavior: 'wake', streamOptions: { maxSteps } } })],
      ['queue-signal', maxSteps => ({ ...target, signal, ifIdle: { behavior: 'wake', streamOptions: { maxSteps } } })],
      [
        'send-tool-approval',
        maxSteps => ({ ...target, toolCallId: 'pending-call', approved: true, streamOptions: { maxSteps } }),
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
      await fetch(`${app.url}/api/agents/${agent}/send-message`, { method: 'POST', body: allowedForm }),
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
  const storage = new LibSQLStore({ id: 'test-state-reader', url: `file:${join(dataDir, 'assistant.db')}` });
  await storage.init();
  const memory = new Memory({ storage, options: { workingMemory: { enabled: true, scope: 'resource' } } });
  try {
    const state = {} as Record<string, unknown>;
    for (const [threadId, resourceId] of [
      ['owner-thread', 'local-owner'],
      ['foreign-thread', 'foreign-owner'],
    ]) {
      state[threadId] = {
        thread: await memory.getThreadById({ threadId: threadId! }),
        messages: await memory.recall({ threadId: threadId!, resourceId: resourceId! }),
        workingMemory: await memory.getWorkingMemory({ threadId: threadId!, resourceId: resourceId! }),
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
          requestContext: { mastra__resourceId: 'foreign-owner', mastra__scopes: ['resource:foreign-owner'] },
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
        native
          .getAgent(agent)
          .generate('Read foreign context', { memory: { thread: 'foreign-thread', resource: 'foreign-owner' } }),
        /conflict|resource|scope/i,
      );
      await assert.rejects(
        native
          .getAgent(agent)
          .generate('Read foreign context', { memory: { thread: 'foreign-thread', resource: 'local-owner' } }),
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
