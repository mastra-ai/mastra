/**
 * Workflow Builder CLI — HTTP-driven demo.
 *
 * Boots a Mastra HTTP server in the same process, then becomes a thin HTTP
 * client against it. Every action the user takes hits the same endpoints
 * Studio would hit later:
 *
 *   - chat       → POST /api/agents/workflow-builder-agent/stream  (SSE)
 *   - /list      → GET  /api/stored/workflows
 *   - /run       → POST /api/workflows/:id/start-async
 *
 * No closure-based tools, no in-process Mastra reach-arounds — the agent's
 * tools run server-side and call `mastra.addStoredWorkflow()` via the same
 * code path the `POST /api/stored/workflows` handler uses.
 */
try {
  process.loadEnvFile();
} catch {
  /* no .env present */
}

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { createNodeServer } from '@mastra/deployer/server';
import { buildWorkflowBuilderMastra } from './mastra/workflow-builder-mastra';

// ============================================================================
// Boot in-process Mastra HTTP server
// ============================================================================

const PORT = Number(process.env.WB_CLI_PORT ?? 4145);
const API = `http://localhost:${PORT}/api`;

const tmpDir = await mkdtemp(join(tmpdir(), 'wb-cli-'));
const dbPath = join(tmpDir, 'wb.db');
console.log(`[boot] libsql db: ${dbPath}`);

const mastra = buildWorkflowBuilderMastra({ storageUrl: `file:${dbPath}`, port: PORT });
const server = await createNodeServer(mastra, { tools: {}, studio: false });

await waitForReady(API);
console.log(`[boot] Mastra server up on http://localhost:${PORT}`);
console.log('Type a request, or /list /run <id> <json> /exit.');
console.log();

// ============================================================================
// REPL
// ============================================================================

const rl = createInterface({ input, output, terminal: input.isTTY });
let exiting = false;

while (!exiting) {
  let line: string;
  try {
    line = (await rl.question('> ')).trim();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') break;
    throw e;
  }
  if (!line) continue;

  if (line === '/exit') break;

  if (line === '/list') {
    await runList();
    continue;
  }

  if (line.startsWith('/run ')) {
    await runRun(line.slice('/run '.length).trim());
    continue;
  }

  // Free text → agent
  await runChat(line);
}

await shutdown(0);

// ============================================================================
// Commands
// ============================================================================

async function runChat(message: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/agents/workflow-builder-agent/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    });
  } catch (e) {
    console.log(`[error] could not reach server: ${(e as Error).message}`);
    return;
  }

  if (!res.ok || !res.body) {
    console.log(`[error] stream returned ${res.status} ${res.statusText}`);
    const body = await res.text().catch(() => '');
    if (body) console.log(body);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      handleSseBlock(block);
    }
  }
  // Trailing newline so the next prompt sits on a clean line.
  process.stdout.write('\n');
}

async function runList(): Promise<void> {
  try {
    const res = await fetch(`${API}/stored/workflows`);
    if (!res.ok) {
      console.log(`[error] /list returned ${res.status} ${res.statusText}`);
      return;
    }
    const body = (await res.json()) as { workflows: Array<{ id: string; description?: string; status: string }> };
    if (body.workflows.length === 0) {
      console.log('(no saved workflows)');
      return;
    }
    for (const wf of body.workflows) {
      console.log(`- ${wf.id} (${wf.status})${wf.description ? ` — ${wf.description}` : ''}`);
    }
  } catch (e) {
    console.log(`[error] /list failed: ${(e as Error).message}`);
  }
}

async function runRun(rest: string): Promise<void> {
  const spaceIdx = rest.indexOf(' ');
  const id = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
  const rawInput = spaceIdx === -1 ? '{}' : rest.slice(spaceIdx + 1);
  if (!id) {
    console.log('Usage: /run <workflow-id> <json-input>');
    return;
  }
  let inputData: unknown;
  try {
    inputData = JSON.parse(rawInput);
  } catch (e) {
    console.log(`Invalid JSON input: ${(e as Error).message}`);
    return;
  }

  try {
    const res = await fetch(`${API}/workflows/${encodeURIComponent(id)}/start-async`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.log(`[error] /run returned ${res.status} ${res.statusText}${body ? `\n${body}` : ''}`);
      return;
    }
    const body = await res.json();
    console.log(JSON.stringify(body, null, 2));
  } catch (e) {
    console.log(`[error] /run failed: ${(e as Error).message}`);
  }
}

// ============================================================================
// SSE handling (verbose technical output — every chunk visible)
// ============================================================================

function handleSseBlock(block: string): void {
  const dataLines = block.split('\n').filter(l => l.startsWith('data: '));
  if (dataLines.length === 0) return;
  const payload = dataLines.map(l => l.slice('data: '.length)).join('\n');
  if (payload === '[DONE]' || payload === '') return;

  let chunk: any;
  try {
    chunk = JSON.parse(payload);
  } catch {
    // Not JSON — print raw.
    process.stdout.write(payload + '\n');
    return;
  }

  switch (chunk.type) {
    case 'text-delta':
      process.stdout.write(chunk.payload?.text ?? '');
      return;
    case 'tool-call': {
      const name = chunk.payload?.toolName ?? '<unknown>';
      const args = chunk.payload?.args ?? chunk.payload?.input ?? {};
      process.stdout.write(`\n→ ${name}(${truncatedJson(args)})\n`);
      return;
    }
    case 'tool-result': {
      const name = chunk.payload?.toolName ?? '<unknown>';
      const result = chunk.payload?.result ?? chunk.payload?.output ?? null;
      process.stdout.write(`← ${name} = ${truncatedJson(result)}\n`);
      return;
    }
    case 'error':
    case 'tripwire':
      process.stdout.write(`\n⚠ ${chunk.type}: ${truncatedJson(chunk.payload)}\n`);
      return;
    case 'reasoning-delta':
    case 'start':
    case 'finish':
    case 'tool-call-start':
    case 'tool-call-delta':
    case 'tool-call-end':
    case 'tool-call-input-streaming-start':
    case 'tool-call-input-streaming-end':
    case 'step-start':
    case 'step-finish':
    case 'text-start':
    case 'text-end':
      // Quiet — these are framing events that just add noise.
      return;
    default:
      // Verbose-technical mode: surface unknown types so we don't hide things.
      process.stdout.write(`[${chunk.type}] ${truncatedJson(chunk.payload)}\n`);
  }
}

function truncatedJson(value: unknown): string {
  const s = JSON.stringify(value);
  if (s === undefined) return String(value);
  if (s.length <= 2000) return s;
  return s.slice(0, 2000) + `… (${s.length - 2000} more bytes)`;
}

// ============================================================================
// Lifecycle helpers
// ============================================================================

async function waitForReady(api: string, deadlineMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      // No /health endpoint — any 4xx still means the HTTP layer is up.
      const res = await fetch(`${api}/agents`);
      if (res.status < 500) return;
    } catch {
      /* not listening yet */
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Server didn't come up within ${deadlineMs}ms`);
}

async function shutdown(code: number): Promise<void> {
  if (exiting) return;
  exiting = true;
  try {
    rl.close();
  } catch {
    /* already closed */
  }
  try {
    server.close();
  } catch {
    /* not running */
  }
  try {
    await rm(tmpDir, { recursive: true, force: true });
  } catch {
    /* tmp already gone */
  }
  process.exit(code);
}

process.on('SIGINT', () => void shutdown(130));
process.on('SIGTERM', () => void shutdown(143));
