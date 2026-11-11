import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/** Inherit OS basics while excluding developer credentials, live endpoints and telemetry configuration. */
export function isolatedEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  // Inherit OS basics only, never developer credentials, provider URLs, or telemetry exporters.
  for (const key of [
    'PATH',
    'HOME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'USER',
    'LOGNAME',
    'SHELL',
    'SystemRoot',
    'WINDIR',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'TZ',
  ]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return { ...env, MASTRA_TELEMETRY_DISABLED: '1', ...extra };
}

/** Reject provider-invalid tool root schemas at the synthetic model boundary. */
export function modelToolSchemaError(body: Record<string, unknown>) {
  const tools = body.tools as
    | { type?: string; function?: { name?: string; parameters?: { type?: string } } }[]
    | undefined;
  const invalid = tools?.find(tool => tool.type === 'function' && tool.function?.parameters?.type !== 'object');
  return invalid
    ? `Invalid schema for function '${invalid.function?.name}': parameters must have type object.`
    : undefined;
}

/** Serve deterministic model responses and record the exact prompts received over HTTP. */
export async function modelFixture(defaultText = 'Preference missing.') {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    const schemaError = modelToolSchemaError(body);
    if (schemaError) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: schemaError } }));
      return;
    }
    const messages = body.messages as { role: string; content: unknown }[];
    const latest = messages.findLast(message => message.role === 'user');
    const remember = JSON.stringify(latest).includes('private-turn-marker');
    const hasToolResult = messages.some(message => message.role === 'tool');
    const toolCall = remember && !hasToolResult;
    const text = remember
      ? 'Saved your preference for concise bullet points.'
      : JSON.stringify(messages).includes('Prefer concise bullet points')
        ? '- Choose one priority.\n- Plan a short work session.'
        : defaultText;
    const message = toolCall
      ? {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'remember-preference',
              type: 'function',
              function: {
                name: 'updateWorkingMemory',
                arguments: JSON.stringify({
                  memory: '# Owner profile\n\n## Preferences\nPrefer concise bullet points.\n',
                }),
              },
            },
          ],
        }
      : { role: 'assistant', content: text };
    const completion = {
      id: 'example-completion',
      object: 'chat.completion',
      created: 1,
      model: body.model,
      choices: [{ index: 0, message, finish_reason: toolCall ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = toolCall
        ? { ...message, tool_calls: message.tool_calls!.map(call => ({ index: 0, ...call })) }
        : message;
      res.write(
        `data: ${JSON.stringify({ ...completion, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
      );
      res.end(
        `data: ${JSON.stringify({ ...completion, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: toolCall ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
      );
    } else {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(completion));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    requests,
    url: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

/** Launch the native assistant in a fresh process with isolated credentials and a local model endpoint. */
export async function startAssistant(dataDir: string, modelUrl: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const child = fork(fileURLToPath(new URL('./server.ts', import.meta.url)), [], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...isolatedEnv(),
      OPENAI_API_KEY: 'example-key',
      ASSISTANT_API_TOKEN: 'example-owner-token-at-least-32-characters',
      ASSISTANT_DATA_DIR: dataDir,
      TEST_MODEL_URL: modelUrl,
      // Deterministic tests must never inherit live Connect credentials or tool policy.
      MASTRA_PROJECT_ID: '',
      MASTRA_PLATFORM_ACCESS_TOKEN: '',
      MASTRA_PLATFORM_SECRET_KEY: '',
      ASSISTANT_CONNECT_PROVIDERS: undefined,
      ASSISTANT_CONNECT_TOOLS: undefined,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let output = '';
  child.stdout!.on('data', chunk => {
    output += chunk;
  });
  child.stderr!.on('data', chunk => {
    output += chunk;
  });
  const exit = once(child, 'exit');
  const ready = once(child, 'message').then(([message]) => message as { port: number });
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Assistant startup timed out: ${output}`)), 30000);
  });
  let port: number;
  try {
    ({ port } = await Promise.race([
      ready,
      timeout,
      exit.then(() => {
        throw new Error(`Assistant startup failed: ${output}`);
      }),
    ]));
  } finally {
    clearTimeout(timer!);
  }
  const headersForOwner = {
    authorization: `Bearer ${extraEnv.ASSISTANT_API_TOKEN ?? 'example-owner-token-at-least-32-characters'}`,
  };
  return {
    child,
    headers: headersForOwner,
    get output() {
      return output;
    },
    url: `http://127.0.0.1:${port}`,
    /** Send an owner API request and retain native server diagnostics when an unexpected failure occurs. */
    async request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = headersForOwner) {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status >= 500)
        throw new Error(`Assistant HTTP ${response.status}: ${await response.text()}\n${output}`);
      return response;
    },
    async stop() {
      child.kill('SIGTERM');
      let timer: NodeJS.Timeout;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Assistant shutdown timed out: ${output}`));
        }, 10000);
      });
      try {
        const result = await Promise.race([exit, timeout]);
        assert.equal(result[0], 0, output);
      } finally {
        clearTimeout(timer!);
      }
    },
  };
}

export async function json(response: Response, expectedStatus = 200) {
  const body = await response.text();
  assert.equal(response.status, expectedStatus, body);
  return JSON.parse(body);
}

/** Read persistent owner and foreign memory through real storage for boundary assertions. */
export async function readState(dataDir: string) {
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

/** Wait for a persisted native pending approval and expose its original call arguments. */
export async function pending(app: Awaited<ReturnType<typeof startAssistant>>, threadId: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const result = await json(
      await app.request(`/agents/personalAssistant/suspended-runs?threadId=${threadId}&resourceId=local-owner`),
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
