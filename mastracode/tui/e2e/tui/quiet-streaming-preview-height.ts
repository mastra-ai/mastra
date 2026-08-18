import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario, McE2eTerminal, McE2eScenarioRuntime } from './types.js';

type PreviewGeometry = {
  detailRows: number;
  editorRow: number;
};

const CHECKPOINT_SAMPLE_COUNT = 4;
const CHECKPOINT_SAMPLE_INTERVAL_MS = 100;

function readPreviewGeometry(terminal: McE2eTerminal): PreviewGeometry {
  const rows = terminal.serialize().view.split('\n');
  const headerRow = rows.findIndex(row => row.includes('▐edit▌') && row.includes('src/quiet-preview.ts'));
  if (headerRow < 0) throw new Error('Expected quiet edit header while sampling preview geometry');

  let detailRows = 0;
  for (let row = headerRow + 1; row < rows.length && /^\s*│(?:\s|$)/.test(rows[row]!); row += 1) {
    detailRows += 1;
  }

  const editorRow = rows.findLastIndex(row => /^╭─+╮$/.test(row));
  if (editorRow < 0) throw new Error('Expected editor border while sampling preview geometry');

  return { detailRows, editorRow };
}

async function sampleCheckpoint(
  label: string,
  marker: RegExp,
  forbiddenMarker: RegExp | undefined,
  terminal: McE2eTerminal,
  runtime: McE2eScenarioRuntime,
): Promise<PreviewGeometry[]> {
  await runtime.waitForScreenText(marker, terminal, 8_000);
  const samples: PreviewGeometry[] = [];

  for (let index = 0; index < CHECKPOINT_SAMPLE_COUNT; index += 1) {
    const view = terminal.serialize().view;
    if (!marker.test(view)) throw new Error(`Checkpoint ${label} disappeared before it could be sampled`);
    if (forbiddenMarker?.test(view)) throw new Error(`Checkpoint ${label} advanced before it could be sampled`);
    samples.push(readPreviewGeometry(terminal));
    await runtime.sleep(CHECKPOINT_SAMPLE_INTERVAL_MS);
  }

  return samples;
}

export const quietStreamingPreviewHeightScenario: McE2eScenario = {
  name: 'quiet-streaming-preview-height',
  description: 'Keep quiet preview and editor geometry stable while deterministic edit arguments stream.',
  testName: 'keeps quiet preview detail rows monotonic through streamed argument checkpoints',
  projectFixture: 'long-branch',
  useOpenAIModel: true,
  aimockFixture: 'quiet-streaming-preview-height.json',
  prepare({ appDataDir, projectDir }) {
    const settingsPath = join(appDataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as any;
    settings.onboarding = { ...settings.onboarding, quietModePreferenceSelected: true };
    settings.preferences = {
      ...settings.preferences,
      quietMode: true,
      quietModeMaxToolPreviewLines: 4,
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    mkdirSync(join(projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(projectDir, 'src', 'quiet-preview.ts'),
      'OLD_PREVIEW_ONE\nOLD_PREVIEW_TWO\nOLD_PREVIEW_THREE\nOLD_PREVIEW_FOUR',
    );
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(120, 30);
    await runtime.waitForScreenText(/Project:/i, terminal);

    terminal.submit('Replace the quiet preview fixture content.');

    // JSON.stringify(arguments) is 201 characters. With chunkSize 61 and tps 1:
    // chunk 2 ends at prefix 122 with four old_string rows, chunk 3 ends at
    // prefix 183 with exactly three new_string rows, and chunk 4 regrows to four.
    const full = await sampleCheckpoint('full old_string', /OLD_PREVIEW_FOUR/, /NEW_PREVIEW_ONE/, terminal, runtime);
    const shorter = await sampleCheckpoint(
      'shorter new_string',
      /NEW_PREVIEW_THREE/,
      /NEW_PREVIEW_FOUR/,
      terminal,
      runtime,
    );
    const regrown = await sampleCheckpoint('regrown new_string', /NEW_PREVIEW_FOUR/, undefined, terminal, runtime);

    await runtime.waitForScreenText(/Quiet preview height e2e complete\./i, terminal, 8_000);
    const complete = [readPreviewGeometry(terminal)];
    const checkpoints = { full, shorter, regrown, complete };
    const allSamples = Object.values(checkpoints).flat();
    if (Object.values(checkpoints).some(samples => samples.length === 0)) {
      throw new Error('Expected every quiet preview checkpoint to be observed');
    }
    if (allSamples.some(sample => sample.detailRows !== 4)) {
      throw new Error(`Expected stable four-row quiet preview geometry, received ${JSON.stringify(checkpoints)}`);
    }
    const firstEditorRow = full[0]!.editorRow;
    if (allSamples.some(sample => sample.editorRow < firstEditorRow)) {
      throw new Error(`Expected the editor row not to move upward, received ${JSON.stringify(checkpoints)}`);
    }

    runtime.printScreen('quiet streaming preview height', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    if (requests.length !== 2) {
      throw new Error(`Expected quiet preview height scenario to make 2 AIMock requests, received ${requests.length}`);
    }
    const second = JSON.stringify(requests[1]);
    for (const needle of ['call_quiet_streaming_preview_height', 'NEW_PREVIEW_FOUR', 'Replaced 1 occurrence']) {
      if (!second.includes(needle)) throw new Error(`Expected second AIMock request to include ${needle}`);
    }
  },
};
