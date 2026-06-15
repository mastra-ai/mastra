import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

export const clipboardImagePasteScenario = {
  name: 'clipboard-image-paste',
  description: 'pastes an image path through bracketed paste and submits it as an attachment',
  testName: 'pastes an image path and submits it as an image attachment in the real TUI',
  useOpenAIModel: true,
  aimockFixture: 'clipboard-image-paste.json',
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
} satisfies McE2eScenario;
