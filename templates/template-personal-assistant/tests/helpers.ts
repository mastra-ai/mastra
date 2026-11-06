import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

export async function modelFixture() {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);
    const messages = body.messages as { role: string; content: unknown }[];
    const latest = messages.findLast(message => message.role === 'user');
    const remember = JSON.stringify(latest).includes('private-turn-marker');
    const hasToolResult = messages.some(message => message.role === 'tool');
    const toolCall = remember && !hasToolResult;
    const text = remember
      ? 'Saved your preference for concise bullet points.'
      : JSON.stringify(messages).includes('Prefer concise bullet points')
        ? '- Choose one priority.\n- Plan a short work session.'
        : 'Preference missing.';
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

export async function startAssistant(dataDir: string, modelUrl: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const child = fork(fileURLToPath(new URL('./server.ts', import.meta.url)), [], {
    execArgv: ['--import', 'tsx'],
    env: {
      ...process.env,
      OPENAI_API_KEY: 'example-key',
      ASSISTANT_DATA_DIR: dataDir,
      TEST_MODEL_URL: modelUrl,
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
  return {
    child,
    url: `http://127.0.0.1:${port}`,
    async request(path: string, method = 'GET', body?: unknown) {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
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
