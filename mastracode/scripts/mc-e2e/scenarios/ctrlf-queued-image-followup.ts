import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const CTRL_F = '\x06';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const START_PROMPT = 'Start a slow Ctrl F queue run.';
const QUEUED_PROMPT = 'Queued Ctrl F image follow-up';
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'ctrlf-queued-image-followup-openai-requests.jsonl');

export const ctrlfQueuedImageFollowupScenario = {
  name: 'ctrlf-queued-image-followup',
  description: 'Queues a pasted-image follow-up with Ctrl+F during an active run and drains it afterward.',
  testName: 'queues and drains a Ctrl+F pasted-image follow-up in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'ctrlf-queued-image-followup.json',
  prepare({ appDataDir, mastracodeDir }) {
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });
    const wrapperPath = join(appDataDir, 'ctrlf-queued-image-followup-main.ts');
    const mainPath = join(mastracodeDir, 'src/main.ts');
    writeFileSync(
      wrapperPath,
      `import { appendFileSync } from 'node:fs';\n` +
        `import { pathToFileURL } from 'node:url';\n` +
        `const capturePath = ${JSON.stringify(RAW_REQUEST_CAPTURE_PATH)};\n` +
        `const originalFetch = globalThis.fetch.bind(globalThis);\n` +
        `globalThis.fetch = async (input, init) => {\n` +
        `  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;\n` +
        `  if (url.includes('/v1/responses') && init?.body) {\n` +
        `    const body = init.body;\n` +
        `    let bodyText;\n` +
        `    let nextInit = init;\n` +
        `    if (typeof body === 'string') bodyText = body;\n` +
        `    else if (body instanceof Uint8Array) bodyText = new TextDecoder().decode(body);\n` +
        `    else if (typeof body.text === 'function') { bodyText = await body.text(); nextInit = { ...init, body: bodyText }; }\n` +
        `    if (bodyText) appendFileSync(capturePath, JSON.stringify({ url, body: bodyText }) + '\\n');\n` +
        `    return originalFetch(input, nextInit);\n` +
        `  }\n` +
        `  return originalFetch(input, init);\n` +
        `};\n` +
        `await import(pathToFileURL(${JSON.stringify(mainPath)}).href);\n`,
    );
  },
  entrypoint({ appDataDir }) {
    return join(appDataDir, 'ctrlf-queued-image-followup-main.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    const imageDir = join(process.cwd(), '.tmp-mc-e2e', 'ctrlf-queued-image-followup');
    const imagePath = join(imageDir, 'queued-image.png');
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, 'base64'));

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.submit(START_PROMPT);
    await runtime.waitForScreenText(/Start a slow Ctrl F queue run\./i, terminal);
    await runtime.sleep(500);

    terminal.write(`${QUEUED_PROMPT} `);
    terminal.write(`${PASTE_START}${imagePath}${PASTE_END}`);
    await runtime.waitForScreenText(/\[image\]/i, terminal, 8_000);
    terminal.write(CTRL_F);
    await runtime.waitForScreenText(/1 queued/i, terminal, 8_000);
    runtime.printScreen('after Ctrl+F queued image follow-up', terminal);

    await runtime.waitForScreenText(/Initial Ctrl F queue run completed\./i, terminal, 18_000);
    await runtime.waitForScreenText(/\[1 image\]\s+Queued Ctrl F image follow-up/i, terminal, 12_000);
    await runtime.waitForScreenText(/Queued Ctrl F follow-up completed\./i, terminal, 12_000);
    runtime.printScreen('after queued image follow-up drained', terminal);

    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected initial and queued AIMock requests, received ${requests.length}`);
    }

    const bodies = JSON.stringify(requests.map((request: any) => request.body));
    if (!bodies.includes(START_PROMPT) || !bodies.includes(QUEUED_PROMPT)) {
      throw new Error(`Expected both initial and queued prompts in AIMock requests: ${bodies.slice(0, 2000)}`);
    }

    const rawRequests = readFileSync(RAW_REQUEST_CAPTURE_PATH, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { body: string });
    const queuedRequest = rawRequests.find(request => request.body.includes(QUEUED_PROMPT));
    if (!queuedRequest) {
      throw new Error(`Expected raw queued OpenAI request: ${rawRequests.map(r => r.body.slice(0, 300)).join('\n---\n')}`);
    }

    if (!queuedRequest.body.includes('image/png') || !queuedRequest.body.includes(TINY_PNG_BASE64)) {
      throw new Error(`Expected queued request to include pasted PNG attachment data: ${queuedRequest.body.slice(0, 3000)}`);
    }
    if (queuedRequest.body.includes('[image]')) {
      throw new Error('Expected editor image placeholder to be removed before queued provider request');
    }
  },
} satisfies McE2eScenario;
