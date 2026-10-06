// Run after building: pnpm --filter @mastra/livekit test:package.
// Installs a packed consumer at the supported LiveKit and Zod minimums, without provider credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const consumer = mkdtempSync(join(tmpdir(), 'mastra-livekit-package-'));
const baseline = '1.7.1';
const zodVersions = ['3.25.76', '4.1.8', '4.6.5'];
const livekitPackages = ['@livekit/agents', '@livekit/agents-plugin-livekit', '@livekit/agents-plugin-silero'];

try {
  assert.equal(manifest.peerDependencies.zod, '^3.25.76 || ^4.1.8');
  for (const name of livekitPackages) assert.equal(manifest.peerDependencies[name], `^${baseline}`);
  const [{ filename }] = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', consumer], {
      cwd: packageRoot,
      encoding: 'utf8',
    }),
  );
  for (const zodVersion of zodVersions) {
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        dependencies: {
          '@mastra/livekit': `file:${join(consumer, filename)}`,
          '@mastra/core': manifest.peerDependencies['@mastra/core'],
          ...Object.fromEntries(livekitPackages.map(name => [name, baseline])),
          '@livekit/rtc-node': '0.13.34',
          'livekit-server-sdk': '2.16.0',
          zod: zodVersion,
          typescript: '5.9.3',
          '@types/node': '22.20.1',
        },
      }),
    );
    execFileSync(
      'npm',
      ['install', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund', '--no-package-lock'],
      {
        cwd: consumer,
        stdio: 'inherit',
      },
    );
    assert.equal(JSON.parse(readFileSync(join(consumer, 'node_modules/zod/package.json'), 'utf8')).version, zodVersion);
    for (const name of livekitPackages) {
      assert.equal(
        JSON.parse(readFileSync(join(consumer, 'node_modules', name, 'package.json'), 'utf8')).version,
        baseline,
      );
    }
    writeFileSync(
      join(consumer, 'smoke.mjs'),
      `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { FlushSentinel, voice } from '@livekit/agents';
const require = createRequire(import.meta.url);
assert.ok(FlushSentinel);
assert.equal(typeof voice.SpeechHandle.prototype.exception, 'function');
for (const [name, member] of [
  ['@mastra/livekit', 'liveKitRecordingRoute'],
  ['@mastra/livekit/plugin', 'mastraLLMNode'],
  ['@mastra/livekit/worker', 'createLiveKitWorker'],
]) {
  assert.equal(typeof (await import(name))[member], 'function');
  assert.equal(typeof require(name)[member], 'function');
}
`,
    );
    const types = `
import { FlushSentinel, voice, type llm } from '@livekit/agents';
import { liveKitRecordingRoute, type LiveKitRecording } from '@mastra/livekit';
import { MastraLLM, mastraLLMNode, observeVoiceSession } from '@mastra/livekit/plugin';
import { createLiveKitWorker } from '@mastra/livekit/worker';
const recording: LiveKitRecording = { url: 'https://recordings.example/call.ogg' };
const url: string = recording.url;
liveKitRecordingRoute({ authorize: () => false, resolveRecording: async () => recording });
void url;
const model: llm.LLM = new MastraLLM({ generate: () => new ReadableStream<string>() });
const node: (agent: voice.Agent, chat: llm.ChatContext, tools: llm.ToolContext, settings: voice.ModelSettings) =>
  Promise<ReadableStream<llm.ChatChunk | string | FlushSentinel> | null> = mastraLLMNode;
const observer: (session: voice.AgentSession) => () => void = session => observeVoiceSession(session, {});
const exception: (handle: voice.SpeechHandle) => unknown = handle => handle.exception();
void [model, node, observer, exception, createLiveKitWorker];
`;
    for (const extension of ['mts', 'cts']) writeFileSync(join(consumer, `smoke.${extension}`), types);
    execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
    execFileSync(
      process.execPath,
      [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--module',
        'nodenext',
        '--target',
        'es2022',
        '--lib',
        'es2023',
        '--types',
        'node',
        'smoke.mts',
        'smoke.cts',
      ],
      { cwd: consumer, stdio: 'inherit' },
    );
    console.log(
      `Packed ESM/CJS entry points and consumer types passed with LiveKit Agents ${baseline} and Zod ${zodVersion}.`,
    );
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
