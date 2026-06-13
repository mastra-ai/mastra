import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'file-attachment-blocked-retry-openai-request.json');
const promptText = 'Please retry attachment after hook';

function hookScript(): string {
  return `const fs = require('node:fs');
const counterPath = '.mastracode/attachment-hook-count.txt';
const count = fs.existsSync(counterPath) ? Number(fs.readFileSync(counterPath, 'utf8')) : 0;
fs.writeFileSync(counterPath, String(count + 1));
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  fs.appendFileSync('.mastracode/attachment-hook-events.jsonl', JSON.stringify({ count: count + 1, message: payload.user_message || '' }) + '\\n');
  if (count === 0) {
    console.log(JSON.stringify({ decision: 'block', reason: 'blocked first attachment retry e2e' }));
    process.exit(2);
  }
  console.log(JSON.stringify({ decision: 'allow' }));
});
`;
}

export const fileAttachmentBlockedRetryScenario = {
  name: 'file-attachment-blocked-retry',
  description: 'Preserves a pasted image when a user prompt hook blocks the first submit and succeeds on retry.',
  testName: 'preserves pasted image attachments after a blocked submit retry',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'file-attachment-blocked-retry.json',
  env() {
    return { MASTRACODE_DISABLE_HOOKS: '0' };
  },
  prepare({ appDataDir, mastracodeDir, projectDir }) {
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });

    const hooksDir = join(projectDir, '.mastracode');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'block-first-attachment.cjs'), hookScript());
    writeFileSync(
      join(hooksDir, 'hooks.json'),
      JSON.stringify(
        {
          UserPromptSubmit: [
            {
              type: 'command',
              command: 'node .mastracode/block-first-attachment.cjs',
              timeout: 3000,
              description: 'block first attachment submit',
            },
          ],
        },
        null,
        2,
      ),
    );

    const wrapperPath = join(appDataDir, 'file-attachment-blocked-retry-main.ts');
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
    return join(appDataDir, 'file-attachment-blocked-retry-main.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    const imageDir = join(process.cwd(), '.tmp-mc-e2e', 'file-attachment-blocked-retry');
    const imagePath = join(imageDir, 'blocked-retry-image.png');
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, 'base64'));

    await runtime.waitForScreenText(/Project: (mastra|project)/i, terminal);

    terminal.write(`${promptText} `);
    terminal.write(`${PASTE_START}${imagePath}${PASTE_END}`);
    await runtime.waitForScreenText(/\[image\]/i, terminal);

    terminal.submit('');
    await runtime.waitForScreenText(/blocked first attachment retry e2e/i, terminal, 8_000);
    await runtime.waitForScreenText(new RegExp(`${promptText}\\s+\\[image\\]`, 'i'), terminal, 8_000);

    terminal.submit('');
    await runtime.waitForScreenText(/\[1 image\]\s+Please retry attachment after hook/i, terminal, 8_000);
    await runtime.waitForScreenText(/MC attachment blocked retry response/i, terminal, 8_000);
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 1) {
      throw new Error(`Expected one AIMock request after retry, received ${requests.length}`);
    }
    const body = JSON.stringify((requests[0] as any).body);
    if (!body.includes(promptText)) {
      throw new Error('Expected retried prompt text in AIMock request');
    }

    const rawRequestBody = readFileSync(RAW_REQUEST_CAPTURE_PATH, 'utf8');
    if (!rawRequestBody.includes('image/png') || !rawRequestBody.includes(TINY_PNG_BASE64)) {
      throw new Error(`Expected pasted PNG attachment data in retry request: ${rawRequestBody.slice(0, 2000)}`);
    }
    if (rawRequestBody.includes('[image]')) {
      throw new Error('Expected editor image placeholder to be removed before retry provider request');
    }
  },
} satisfies McE2eScenario;
