// Run after building: pnpm --filter @mastra/livekit test:package.
// Installs a packed consumer at the supported LiveKit and Zod minimums, without provider credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const temporaryRoot = mkdtempSync(join(tmpdir(), 'mastra-livekit-package-'));
const baseline = '1.7.1';
const clientBaseline = '1.51.2';
const zodVersions = ['3.25.76', '4.1.8', '4.6.5'];
const livekitPackages = ['@livekit/agents', '@livekit/agents-plugin-livekit', '@livekit/agents-plugin-silero'];

try {
  assert.equal(manifest.peerDependencies['@mastra/client-js'], `>=${clientBaseline} <2.0.0-0`);
  assert.equal(manifest.peerDependenciesMeta['@mastra/client-js'].optional, true);
  assert.equal(manifest.peerDependencies.zod, '^3.25.76 || ^4.1.8');
  for (const name of livekitPackages) assert.equal(manifest.peerDependencies[name], `^${baseline}`);
  const [{ filename }] = JSON.parse(
    execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporaryRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
    }),
  );
  for (const zodVersion of zodVersions) {
    // The published SDK's legacy @ai-sdk/ui-utils dependency requires Zod 3 under strict npm installs.
    // Check its minimum with Zod 3; server/worker consumers also support Zod 4 without the optional SDK.
    const testClient = zodVersion === '3.25.76';
    const consumer = mkdtempSync(join(temporaryRoot, `zod-${zodVersion}-`));
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({
        private: true,
        type: 'module',
        dependencies: {
          '@mastra/livekit': `file:${join(temporaryRoot, filename)}`,
          '@mastra/core': manifest.peerDependencies['@mastra/core'],
          ...(testClient ? { '@mastra/client-js': clientBaseline } : {}),
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
  ${testClient ? "['@mastra/livekit/client', 'getLiveKitRecording']," : ''}
  ['@mastra/livekit/plugin', 'mastraLLMNode'],
  ['@mastra/livekit/worker', 'createLiveKitWorker'],
]) {
  assert.equal(typeof (await import(name))[member], 'function');
  assert.equal(typeof require(name)[member], 'function');
}
${
  testClient
    ? `
const { MastraClient } = await import('@mastra/client-js');
const client = new MastraClient({
  baseUrl: 'https://mastra.example', apiPrefix: '/custom-api',
  headers: { Authorization: 'Bearer session' }, credentials: 'include',
  fetch: async (url, options) => {
    assert.equal(url, 'https://mastra.example/voice/livekit/recordings/trace%2F42');
    assert.equal(options.headers.Authorization, 'Bearer session');
    assert.equal(options.credentials, 'include');
    return Response.json({ status: 'unavailable' });
  },
});
for (const entry of [await import('@mastra/livekit/client'), require('@mastra/livekit/client')]) {
  assert.deepEqual(await entry.getLiveKitRecording(client, 'trace/42'), { status: 'unavailable' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(entry.getLiveKitRecording(client, 'trace/42', { signal: controller.signal }), { name: 'AbortError' });
}
`
    : ''
}
`,
    );
    const types = `
import { FlushSentinel, voice, type llm } from '@livekit/agents';
import { liveKitRecordingRoute, type LiveKitRecording } from '@mastra/livekit';
import { MastraLLM, mastraLLMNode, observeVoiceSession } from '@mastra/livekit/plugin';
import { createLiveKitWorker } from '@mastra/livekit/worker';
${
  testClient
    ? `
import { getLiveKitRecording, type LiveKitRecordingResponse } from '@mastra/livekit/client';
import { MastraClient } from '@mastra/client-js';
const response: Promise<LiveKitRecordingResponse> = getLiveKitRecording(
  new MastraClient({ baseUrl: 'https://mastra.example' }), 'trace', { signal: new AbortController().signal },
);
void response;
`
    : ''
}
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
    if (testClient) {
      // Server/worker users do not need to install the optional client SDK peer.
      const clientPath = join(consumer, 'node_modules/@mastra/client-js');
      const hiddenClientPath = join(consumer, 'client-js-hidden');
      renameSync(clientPath, hiddenClientPath);
      try {
        execFileSync(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `
        import { createRequire } from 'node:module';
        const require = createRequire(import.meta.url);
        for (const name of ['@mastra/livekit', '@mastra/livekit/plugin', '@mastra/livekit/worker']) {
          await import(name);
          require(name);
        }
      `,
          ],
          { cwd: consumer, stdio: 'inherit' },
        );
      } finally {
        renameSync(hiddenClientPath, clientPath);
      }
    }
    console.log(
      `Packed ESM/CJS entry points and consumer types passed with LiveKit Agents ${baseline} and Zod ${zodVersion}${testClient ? `; client SDK ${clientBaseline}` : '; no client SDK'}.`,
    );
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
