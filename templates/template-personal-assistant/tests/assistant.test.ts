import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { createAssistant } from '../src/mastra/assistant';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
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

async function pending(app: Awaited<ReturnType<typeof startAssistant>>, threadId: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await json(
      await app.request(`/agents/${agent}/suspended-runs?threadId=${threadId}&resourceId=local-owner`),
    );
    if (result.runs.length)
      return result.runs[0] as { runId: string; toolCalls: { toolCallId: string; toolName: string; args: unknown }[] };
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
          : { messages: [{ role: 'user', content: prompt }], memory: { thread }, ...streamOptions };
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
      await nativeAgent.declineToolCallGenerate({ runId: output.runId, toolCallId: 'call-write-0' });
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
    const finalInput = fixture.models.at(-1)!.messages as { role: string; tool_call_id?: string; content: unknown }[];
    const createdInput = finalInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-0',
    );
    const failedInput = finalInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-1',
    );
    assert.ok(createdInput, 'The model must receive the actual creation result.');
    assert.deepEqual(JSON.parse(String(createdInput.content)), { documentId, revisionId: 'revision-1' });
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
    const successInput = fixture.models.at(-1)!.messages as { role: string; tool_call_id?: string; content: unknown }[];
    const insertionResult = successInput.find(
      message => message.role === 'tool' && message.tool_call_id === 'call-partial-1',
    );
    assert.ok(insertionResult);
    assert.deepEqual(JSON.parse(String(insertionResult.content)), { documentId: successfulDocumentId, replies: [{}] });
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
            args: { action: 'set', objective: 'Prepare a meeting agenda and wait for owner review.' },
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
        [{ name: 'task_write', args: { tasks: stable.tasks.map(task => ({ ...task, status: 'in_progress' })) } }],
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
    const noBudget = await progressTurn(app, thread, { calls: [[{ name: 'objective', args: { action: 'resume' } }]] });
    assert.match(noBudget.text, /additional evaluation allowance/);
    assert.deepEqual((await progressState(dataDir, thread)).objective, exhausted);
    for (const invalid of [
      { action: 'set', objective: 'Bad limit', maxEvaluations: 0 },
      { action: 'set', objective: 'Bad limit', maxEvaluations: 6 },
      { action: 'resume', additionalEvaluations: 1.5 },
      { action: 'inspect', objective: 'Unexpected field' },
      { action: 'clear' },
      { action: 'set', objective: 'Thread injection', threadId: 'another-thread', ownerId: 'foreign-owner' },
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
    await progressTurn(app, thread, { calls: [[{ name: 'objective', args: { action: 'pause' } }]] });
    assert.equal((await progressState(dataDir, thread)).objective?.status, 'paused');
    fixture.state.failJudge = true;
    await progressTurn(app, thread, { calls: [[{ name: 'objective', args: { action: 'resume' } }]] });
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
    app = await startAssistant(dataDir, fixture.modelUrl, { ...fixture.env, TEST_SEED_FOREIGN: 'true' });
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
            calls: [[{ name: 'google_docs_create_document', args: { title: 'Agenda: recovery planning' } }]],
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
      messages: [{ role: 'user', content: JSON.stringify({ calls: [[{ name: 'task_check', args: {} }]] }) }],
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
