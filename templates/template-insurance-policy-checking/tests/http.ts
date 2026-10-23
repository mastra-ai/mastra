import { createServer, request, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

export async function controlledProvider(fail = false) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body) as Record<string, unknown>);
    if (fail) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({ error: { message: 'SENTINEL_PRIVATE_PROVIDER_SECRET', type: 'invalid_request_error' } }),
      );
      return;
    }
    const modelRequest = JSON.parse(body) as {
      messages: { role: string; content: unknown }[];
      tools?: { function?: { name: string } }[];
    };
    const roles = modelRequest.messages.map(message => message.role);
    const lastUser = roles.lastIndexOf('user');
    const lastTool = roles.lastIndexOf('tool');
    const requestStatus = lastUser > lastTool && modelRequest.tools?.some(tool => tool.function?.name === 'caseStatus');
    const delta = requestStatus
      ? {
          role: 'assistant',
          tool_calls: [
            {
              index: 0,
              id: `read_case_${requests.length}`,
              type: 'function',
              function: { name: 'caseStatus', arguments: '{}' },
            },
          ],
        }
      : {
          role: 'assistant',
          content: 'The PDFs were captured locally. Please identify the document roles and comparison intent.',
        };
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const chunk of [
      { id: 'local-response', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }] },
      {
        id: 'local-response',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: {}, finish_reason: requestStatus ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      },
    ])
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    response.end('data: [DONE]\n\n');
  });
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No provider socket');
  return { requests, url: `http://127.0.0.1:${address.port}/v1`, close: () => closeServer(server) };
}
const closeServer = (server: Server) =>
  new Promise<void>((resolveClose, reject) => server.close(error => (error ? reject(error) : resolveClose())));
export async function requestHost(url: string, host: string) {
  return new Promise<number>((resolveStatus, reject) => {
    const outgoing = request(url, { headers: { Host: host } }, response => {
      response.resume();
      response.on('end', () => resolveStatus(response.statusCode ?? 0));
    });
    outgoing.on('error', reject);
    outgoing.end();
  });
}
export async function freePort() {
  const server = createServer();
  await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No port');
  const port = address.port;
  await closeServer(server);
  return port;
}
export async function startStudio(dataRoot: string, providerUrl?: string, processingBudget?: unknown) {
  const port = await freePort();
  // The installed CLI selects child NODE_ENV from its env-file map, not the parent environment.
  const environmentFile = resolve(dataRoot, 'studio-test.env');
  await writeFile(environmentFile, 'NODE_ENV=test\n', { mode: 0o600 });
  const processHandle = spawn(
    process.execPath,
    [resolve('node_modules/mastra/dist/index.js'), 'dev', '--env', environmentFile],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DO_NOT_TRACK: '1',
        NODE_ENV: 'test',
        PORT: String(port),
        POLICY_DATA_DIR: dataRoot,
        POLICY_TEST_PROVIDER_URL: providerUrl ?? '',
        POLICY_PROCESSING_BUDGET: processingBudget ? JSON.stringify(processingBudget) : '',
        POLICY_TEST_PROCESSING_ONLY: processingBudget ? '1' : '',
        PATH: `${resolve(process.execPath, '..')}:${process.env.PATH}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let logs = '';
  processHandle.stdout?.on('data', chunk => (logs += String(chunk)));
  processHandle.stderr?.on('data', chunk => (logs += String(chunk)));
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw Error(`Installed Studio stopped before readiness: ${logs}`);
    try {
      if ((await fetch(`${url}/api/agents`)).ok)
        return { url, port, logs: () => logs, close: () => stopProcess(processHandle) };
    } catch {}
    await delay(250);
  }
  await stopProcess(processHandle);
  throw Error(`Installed Studio readiness timed out: ${logs}`);
}
async function stopProcess(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  await Promise.race([new Promise<void>(resolveExit => child.once('exit', () => resolveExit())), delay(10_000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
