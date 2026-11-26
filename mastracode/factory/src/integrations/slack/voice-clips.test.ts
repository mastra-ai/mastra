import type { ChannelHandler } from '@mastra/core/channels';
import { stringifyMarkdown } from 'chat';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { factoryProjectSettingsUserId } from '../../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { transcribeVoiceClips, VOICE_CLIP_TIMEOUT_MS, voiceClipFailureCard } from './voice-clips.js';
import type { VoiceClipReport } from './voice-clips.js';

type Message = Parameters<ChannelHandler>[1];
type Attachment = Message['attachments'][number];

const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MISTRAL_URL = 'https://api.mistral.ai/v1/audio/transcriptions';

interface ProviderCall {
  authorization: string | null;
  model: FormDataEntryValue | null;
  filename: string | undefined;
}

const calls: { openai: ProviderCall[]; mistral: ProviderCall[] } = { openai: [], mistral: [] };

async function record(request: Request): Promise<ProviderCall> {
  const form = await request.formData();
  const file = form.get('file');
  return {
    authorization: request.headers.get('authorization'),
    model: form.get('model'),
    filename: file instanceof File ? file.name : undefined,
  };
}

const server = setupServer(
  http.post(OPENAI_URL, async ({ request }) => {
    calls.openai.push(await record(request));
    return HttpResponse.json({ text: 'hello from whisper' });
  }),
  http.post(MISTRAL_URL, async ({ request }) => {
    calls.mistral.push(await record(request));
    return HttpResponse.json({ model: 'voxtral-mini-latest', text: 'ship the fix', language: 'en', usage: {} });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  calls.openai = [];
  calls.mistral = [];
});
afterEach(() => server.resetHandlers());

const SENDER = { orgId: 'org1', userId: 'user-a' };

let clipCount = 0;

function voiceClip(overrides: Partial<Attachment> = {}): Attachment {
  return {
    type: 'audio',
    name: 'audio_message.m4a',
    url: `https://files.slack.com/files-pri/T1-F${(clipCount += 1)}/audio_message.m4a`,
    mimeType: 'audio/mp4',
    size: 15,
    fetchData: async () => Buffer.from('fake aac bytes'),
    ...overrides,
  };
}

/** `recorded` are the files Slack's event marks as composer recordings (`subtype: 'slack_audio'`). */
function message(id: string, attachments: Attachment[], recorded: Attachment[] = attachments): Message {
  const files = attachments.map(attachment => ({
    url_private: attachment.url,
    ...(recorded.includes(attachment) ? { subtype: 'slack_audio' } : {}),
  }));
  return {
    id,
    text: '',
    formatted: { type: 'root', children: [] },
    attachments,
    raw: { type: 'message', files },
  } as unknown as Message;
}

function agentReads(msg: Message): string {
  return stringifyMarkdown(msg.formatted).trim();
}

describe('transcribeVoiceClips', () => {
  it("replaces a clip with its transcript, using the sender's saved model and key", async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'openai-codex', { type: 'api_key', key: 'sk-openai' });
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    await seed.voiceSettings.set({ ...SENDER, provider: 'mistral', model: 'voxtral-mini-latest' });
    const clip = voiceClip();
    const msg = message('m1', [clip]);

    await transcribeVoiceClips([msg], SENDER, {
      modelCredentials: seed.credentials,
      voiceSettings: seed.voiceSettings,
    });

    expect(msg.attachments).toEqual([]);
    expect(agentReads(msg)).toBe('ship the fix');
    expect(msg.text).toBe('ship the fix');
    expect(calls.openai).toEqual([]);
    expect(calls.mistral).toEqual([
      { authorization: 'Bearer sk-mistral', model: 'voxtral-mini-latest', filename: expect.stringMatching(/\.m4a$/) },
    ]);
  });

  it("doesn't bill the org key outside a factory-scope Factory", async () => {
    // Only a `factory`-scope Factory spends the org's keys; user and hybrid scopes bill the sender, like chat.
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Voice', modelScope: 'hybrid' },
    });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    const msg = message('m1', [voiceClip()]);

    const report = await transcribeVoiceClips(
      [msg],
      SENDER,
      { modelCredentials: seed.credentials, voiceSettings: seed.voiceSettings },
      { run: async () => project },
    );

    expect(report).toEqual({
      transcribed: 0,
      failures: [{ reason: expect.stringContaining('API key'), fix: 'settings' }],
      settingsFactoryId: project.id,
    });
    expect(calls.openai).toEqual([]);
  });

  it.each([
    ['user', true],
    ['factory', false],
  ] as const)(
    "points a chat-only clip's missing personal key at a %s-scope home Factory's settings only when they show personal keys",
    async (modelScope, linked) => {
      const seed = await createFactoryStorageForTests();
      const home = await seed.projects.create({ ...SENDER, input: { name: 'Home', modelScope } });

      const report = await transcribeVoiceClips(
        [message('m1', [voiceClip()])],
        SENDER,
        { modelCredentials: seed.credentials },
        { home: async () => home },
      );

      expect(report.settingsFactoryId).toBe(linked ? home.id : undefined);
    },
  );

  it("follows the run's Factory model scope: factory scope uses its model and the org key, ignoring personal ones", async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({
      orgId: 'org1',
      userId: 'user-a',
      input: { name: 'Voice', modelScope: 'factory' },
    });
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-personal' });
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    await seed.voiceSettings.set({ ...SENDER, provider: 'mistral', model: 'voxtral-mini-latest' });
    await seed.voiceSettings.set({
      orgId: 'org1',
      userId: factoryProjectSettingsUserId(project.id),
      provider: 'openai',
      model: 'whisper-1',
    });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips(
      [msg],
      SENDER,
      { modelCredentials: seed.credentials, voiceSettings: seed.voiceSettings },
      { run: async () => project },
    );

    expect(agentReads(msg)).toBe('hello from whisper');
    expect(calls.openai.map(c => c.authorization)).toEqual(['Bearer sk-org']);
    expect(calls.mistral).toEqual([]);
  });

  it('transcribes clips from earlier messages batched into the same run', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const earlier = message('m1', [voiceClip()]);
    const latest = message('m2', [voiceClip({ name: 'second.m4a' })]);

    await transcribeVoiceClips([earlier, latest], SENDER, { modelCredentials: seed.credentials });

    expect(agentReads(earlier)).toBe('ship the fix');
    expect(agentReads(latest)).toBe('ship the fix');
    expect(calls.mistral).toHaveLength(2);
  });

  it('detaches a clip it cannot transcribe for a missing key, without calling a provider or writing to the text', async () => {
    const seed = await createFactoryStorageForTests();
    const image: Attachment = { type: 'image', mimeType: 'image/png', name: 'shot.png' };
    const msg = message('m1', [voiceClip(), image]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([image]);
    expect(msg.text).toBe('');
    expect(agentReads(msg)).toBe('');
    expect(report.failures).toEqual([{ reason: expect.stringContaining('API key'), fix: 'settings' }]);
    expect(calls.openai).toEqual([]);
    expect(calls.mistral).toEqual([]);
  });

  it('asks for a resend, without the lookup error, when the key lookup fails', async () => {
    const seed = await createFactoryStorageForTests();
    vi.spyOn(seed.credentials, 'listCredentials').mockRejectedValueOnce(new Error('connection reset'));
    const msg = message('m1', [voiceClip()]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([]);
    expect(report.failures).toEqual([{ reason: 'Speech-to-text settings could not be loaded.', fix: 'retry' }]);
  });

  it('lets a Factory routing failure propagate instead of guessing a Factory', async () => {
    const seed = await createFactoryStorageForTests();
    const msg = message('m1', [voiceClip()]);

    await expect(
      transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials }, {
        run: async () => {
          throw new Error('ambiguous Factory binding');
        },
      }),
    ).rejects.toThrow('ambiguous Factory binding');
  });

  it('fails an unlinked sender’s clip instead of using anyone else’s key', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mistral', { type: 'api_key', key: 'sk-org' });
    const msg = message('m1', [voiceClip()]);

    const report = await transcribeVoiceClips([msg], undefined, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: expect.stringContaining('linked Mastra account'), fix: 'none' }]);
    expect(msg.attachments).toEqual([]);
    expect(calls.mistral).toEqual([]);
  });

  it('skips clips over the size cap without downloading them', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    let downloaded = false;
    const msg = message('m1', [
      voiceClip({
        size: 50 * 1024 * 1024,
        fetchData: async () => {
          downloaded = true;
          return Buffer.alloc(0);
        },
      }),
    ]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: 'The clip is too long.', fix: 'shorter' }]);
    expect(downloaded).toBe(false);
    expect(calls.mistral).toEqual([]);
  });

  it('fails a clip of unknown size whose download turns out over the cap, without calling a provider', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip({ size: undefined, fetchData: async () => Buffer.alloc(9 * 1024 * 1024) })]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: 'The clip is too long.', fix: 'shorter' }]);
    expect(calls.mistral).toEqual([]);
  });

  it('keeps transcribing the other clips of a message when one fails', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [
      voiceClip({ name: 'standup.m4a' }),
      voiceClip({ name: 'huge.m4a', size: 50 * 1024 * 1024 }),
    ]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([]);
    expect(agentReads(msg)).toBe('ship the fix');
    expect(report.failures).toEqual([{ reason: 'The clip is too long.', fix: 'shorter' }]);
  });

  it('gives up on a clip whose download never finishes and asks for a resend', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const download = Promise.withResolvers<void>();
    const msg = message('m1', [
      voiceClip({
        fetchData: () => {
          download.resolve();
          return new Promise<Buffer>(() => {});
        },
      }),
    ]);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let report: VoiceClipReport;
    try {
      const done = transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });
      await download.promise;
      await vi.advanceTimersByTimeAsync(VOICE_CLIP_TIMEOUT_MS);
      report = await done;
    } finally {
      vi.useRealTimers();
    }

    expect(msg.attachments).toEqual([]);
    expect(report.failures).toEqual([{ reason: 'Transcription timed out after 60 seconds.', fix: 'retry' }]);
    expect(calls.mistral).toEqual([]);
  });

  it('keeps the provider response out of the failure reason', async () => {
    server.use(
      http.post(MISTRAL_URL, () =>
        HttpResponse.json({ message: 'boom', account: 'acct-internal-42' }, { status: 500 }),
      ),
    );
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip()]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: expect.any(String), fix: 'retry' }]);
    expect(JSON.stringify(voiceClipFailureCard(report, 'mention me again'))).not.toMatch(/boom|acct-internal-42|500/);
  });

  it('points a rejected key at voice settings', async () => {
    server.use(http.post(MISTRAL_URL, () => HttpResponse.json({ detail: 'Invalid API Key' }, { status: 401 })));
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral-revoked' });
    const msg = message('m1', [voiceClip()]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: 'The speech-to-text provider rejected the API key.', fix: 'settings' }]);
    expect(JSON.stringify(voiceClipFailureCard(report, 'mention me again'))).not.toContain('sk-mistral-revoked');
  });

  it('keeps the Slack file URL out of a download failure', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [
      voiceClip({
        fetchData: async () => {
          throw new Error('Received HTML from https://files.slack.com/files-pri/T1-F9/audio_message.m4a');
        },
      }),
    ]);

    const report = await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(report.failures).toEqual([{ reason: 'The clip could not be downloaded.', fix: 'retry' }]);
    expect(calls.mistral).toEqual([]);
  });


  it('leaves an uploaded audio file as an attachment without calling a provider', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const upload = voiceClip({ name: 'interview.mp3', mimeType: 'audio/mpeg' });
    const msg = message('m1', [upload], []);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([upload]);
    expect(agentReads(msg)).toBe('');
    expect(calls.mistral).toEqual([]);
  });

  it('leaves a non-audio upload named like a clip as an attachment', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const upload = voiceClip({ type: 'file', name: 'audio_message.pdf', mimeType: 'application/pdf' });
    const msg = message('m1', [upload], []);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([upload]);
    expect(calls.mistral).toEqual([]);
  });

  it('transcribes a recorded clip Slack labels as video', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip({ type: 'video', name: 'audio_message.mp4', mimeType: 'video/mp4' })]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([]);
    expect(agentReads(msg)).toBe('ship the fix');
    expect(calls.mistral.map(c => c.filename)).toEqual([expect.stringMatching(/\.mp4$/)]);
  });

  it('transcribes a recorded clip whose event carries no subtype', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const clip = voiceClip();
    const msg = message('m1', [clip], []);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([]);
    expect(agentReads(msg)).toBe('ship the fix');
  });

  it('leaves messages without voice clips untouched', async () => {
    const seed = await createFactoryStorageForTests();
    const image: Attachment = { type: 'image', mimeType: 'image/png', name: 'shot.png' };
    const msg = message('m1', [image]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([image]);
  });
});

describe('voiceClipFailureCard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function hasSettingsButton(card: unknown): boolean {
    return JSON.stringify(card).includes('Open voice settings');
  }

  it('sums up every failed clip of a batch in one card that asks for a resend, with no settings link', async () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://mc.example.com');
    server.use(http.post(MISTRAL_URL, () => HttpResponse.json({ message: 'Too many requests' }, { status: 429 })));
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const project = await seed.projects.create({ ...SENDER, input: { name: 'Voice', modelScope: 'user' } });
    const earlier = message('m1', [voiceClip()]);
    const latest = message('m2', [voiceClip()]);

    const report = await transcribeVoiceClips(
      [earlier, latest],
      SENDER,
      { modelCredentials: seed.credentials },
      { run: async () => project },
    );
    const card = voiceClipFailureCard(report, 'mention me again');

    expect(card.title).toBe('2 voice clips not transcribed');
    expect(JSON.stringify(card)).toContain('rate limiting');
    expect(JSON.stringify(card)).toContain('Wait a moment, then mention me again with the clip.');
    expect(hasSettingsButton(card)).toBe(false);
  });

  it('links a setup problem to the voice input section of the Factory settings', () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', 'https://mc.example.com/');
    const card = voiceClipFailureCard(
      {
        transcribed: 0,
        failures: [{ reason: 'The speech-to-text provider rejected the API key.', fix: 'settings' }],
        settingsFactoryId: 'fp 1',
      },
      'message me again',
    );

    expect(JSON.stringify(card)).toContain('https://mc.example.com/factories/fp%201/settings/models#voice-input');
    expect(JSON.stringify(card)).toContain("Once that's fixed, message me again with the clip.");
  });

  it('still explains a setup problem when the server has no public URL to link to', () => {
    vi.stubEnv('MASTRACODE_PUBLIC_URL', '');
    const card = voiceClipFailureCard(
      {
        transcribed: 0,
        failures: [{ reason: 'The speech-to-text provider rejected the API key.', fix: 'settings' }],
        settingsFactoryId: 'fp-1',
      },
      'mention me again',
    );

    expect(card.title).toBe('Voice clip not transcribed');
    expect(JSON.stringify(card)).toContain('rejected the API key');
    expect(hasSettingsButton(card)).toBe(false);
  });
});
