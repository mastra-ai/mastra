import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installOpenAIFetchCapture } from './openai-fetch-capture.js';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'clipboard-image-paste-openai-request.json');

function getRequestBody(request: unknown): unknown {
  return typeof request === 'object' && request !== null && 'body' in request ? request.body : undefined;
}

export const clipboardImagePasteScenario = {
  name: 'clipboard-image-paste',
  description: 'pastes an image path through bracketed paste and submits it as an attachment',
  testName: 'pastes an image path and submits it as an image attachment in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'clipboard-image-paste.json',
  prepare() {
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });
  },
  async inProcessApp({ startMastraCodeApp }) {
    const restoreFetch = installOpenAIFetchCapture({ capturePath: RAW_REQUEST_CAPTURE_PATH });
    const app = await startMastraCodeApp();
    return {
      stop: async () => {
        await app.stop?.();
        restoreFetch();
      },
    };
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
    const body = JSON.stringify(getRequestBody(requests[0]));
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
