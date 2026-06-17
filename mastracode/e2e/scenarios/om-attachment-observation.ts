import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installOpenAIFetchCapture } from './openai-fetch-capture.js';
import type { McE2eScenario } from './types.js';

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const promptText = 'Please observe this pasted attachment in OM';
const thresholdFiller = ' attachment observation retention marker'.repeat(900);
const RAW_REQUEST_CAPTURE_PATH = join(process.cwd(), '.tmp-mc-e2e', 'om-attachment-observation-openai-requests.jsonl');

export const omAttachmentObservationScenario = {
  name: 'om-attachment-observation',
  description: 'Proves Observational Memory receives submitted pasted-image attachment parts from the real TUI path.',
  testName: 'observes submitted pasted image attachment parts in OM input',
  useOpenAIModel: true,
  aimockFixture: 'om-attachment-observation.json',
  env() {
    return { MASTRACODE_DISABLE_MEMORY: '0' };
  },
  prepare({ appDataDir }) {
    rmSync(RAW_REQUEST_CAPTURE_PATH, { force: true });

    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    settings.onboarding = {
      ...((typeof settings.onboarding === 'object' && settings.onboarding !== null ? settings.onboarding : {}) as Record<string, unknown>),
      completedAt: new Date(0).toISOString(),
      skippedAt: null,
      version: 1,
      quietModePreferenceSelected: true,
    };
    settings.models = {
      ...((typeof settings.models === 'object' && settings.models !== null ? settings.models : {}) as Record<string, unknown>),
      observerModelOverride: 'openai/gpt-5.4-mini',
      reflectorModelOverride: 'openai/gpt-5.4-mini',
      omObservationThreshold: 2100,
      omReflectionThreshold: 100_000,
      omObserveAttachments: true,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  },
  async inProcessApp({ startMastraCodeApp }) {
    const restoreFetch = installOpenAIFetchCapture({ capturePath: RAW_REQUEST_CAPTURE_PATH, append: true, inputTokens: 2600 });
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

    const imageDir = join(process.cwd(), '.tmp-mc-e2e', 'om-attachment-observation');
    const imagePath = join(imageDir, 'om-observed-image.png');
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from(TINY_PNG_BASE64, 'base64'));

    await runtime.waitForScreenText(/Mastra Code|Project:/i, terminal);

    terminal.write(`${promptText}${thresholdFiller} `);
    terminal.write(`${PASTE_START}${imagePath}${PASTE_END}`);
    await runtime.waitForScreenText(/\[image\]/i, terminal, 8_000);

    terminal.submit('');
    await runtime.waitForScreenText(/OM_ATTACHMENT_STEP_DONE/i, terminal, 12_000);
    await runtime.waitForScreenText(/User submitted an image attachment for OM observation/i, terminal, 45_000);
    await runtime.waitForScreenText(/Current task:\s+OM attachment observation e2e complete/i, terminal, 45_000);
    await runtime.waitForScreenText(/Suggested response:\s+Continue the recovery loop/i, terminal, 45_000);
    await runtime.waitForScreenText(/thread title updated:\s+Attachment observation/i, terminal, 45_000);
    await runtime.waitForScreenText(/MC OM attachment chat response/i, terminal, 45_000);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length < 2) {
      throw new Error(`Expected chat and observer AIMock requests, received ${requests.length}`);
    }

    const rawRequests = readFileSync(RAW_REQUEST_CAPTURE_PATH, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as { body: string });
    const observerRequest = rawRequests.find(request => request.body.includes('## New Message History to Observe'));
    if (!observerRequest) {
      throw new Error(`Expected an OM observer request in raw OpenAI traffic: ${rawRequests.map(r => r.body.slice(0, 300)).join('\n---\n')}`);
    }

    const body = observerRequest.body;
    if (!body.includes('[Image #1') || !body.includes('image/png') || !body.includes(TINY_PNG_BASE64)) {
      throw new Error(`Expected observer request to include attachment placeholder and pasted PNG part: ${body.slice(0, 3000)}`);
    }
    if (body.includes('[image]')) {
      throw new Error('Expected editor placeholder to be replaced before OM observation input');
    }
  },
} satisfies McE2eScenario;
