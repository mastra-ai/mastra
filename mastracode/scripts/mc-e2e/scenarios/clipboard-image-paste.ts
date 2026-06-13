import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'clipboard-image-paste-openai-request.json');

export const clipboardImagePasteScenario = {
  name: 'clipboard-image-paste',
  description: 'pastes an image path through bracketed paste and submits it as an attachment',
  testName: 'pastes an image path and submits it as an image attachment in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'clipboard-image-paste.json',
  prepare({ appDataDir, mastracodeDir }) {
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });
    const wrapperPath = join(appDataDir, 'clipboard-image-paste-main.ts');
    const mainPath = join(mastracodeDir, 'src/main.ts');
    writeFileSync(
      wrapperPath,
      `import { writeFileSync } from 'node:fs';\n` +
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
        `    if (bodyText) writeFileSync(capturePath, bodyText);\n` +
        `    return originalFetch(input, nextInit);\n` +
        `  }\n` +
        `  return originalFetch(input, init);\n` +
        `};\n` +
        `await import(pathToFileURL(${JSON.stringify(mainPath)}).href);\n`,
    );
  },
  entrypoint({ appDataDir }) {
    return join(appDataDir, 'clipboard-image-paste-main.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    const imageDir = join(process.cwd(), '.tmp-mc-e2e', 'clipboard-image-paste');
    const imagePath = join(imageDir, 'pasted-image.png');
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, 'base64'));

    await runtime.waitForScreenText(/Project: mastra/i, terminal);

    terminal.write('Please inspect the pasted image ');
    terminal.write(`${PASTE_START}${imagePath}${PASTE_END}`);
    await runtime.waitForScreenText(/\[image\]/i, terminal);
    runtime.printScreen('after image paste', terminal);

    terminal.submit('');
    await runtime.waitForScreenText(/\[1 image\]\s+Please inspect the pasted image/i, terminal);
    await runtime.waitForScreenText(/MC clipboard image paste response/i, terminal);
    runtime.printScreen('after image response', terminal);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected one AIMock request, received ${requests.length}`);
    }
    const request = requests[0] as any;
    const body = JSON.stringify(request.body);
    if (!body.includes('Please inspect the pasted image')) {
      throw new Error('Expected submitted text content in AIMock request');
    }

    const rawRequestBody = readFileSync(RAW_REQUEST_CAPTURE_PATH, 'utf8');
    if (!rawRequestBody.includes('image/png') || !rawRequestBody.includes(TINY_PNG_BASE64)) {
      throw new Error(`Expected pasted PNG attachment data in raw OpenAI request: ${rawRequestBody.slice(0, 2000)}`);
    }
    if (rawRequestBody.includes('[image]')) {
      throw new Error('Expected editor image placeholder to be removed before raw provider request');
    }
  },
} satisfies McE2eScenario;
