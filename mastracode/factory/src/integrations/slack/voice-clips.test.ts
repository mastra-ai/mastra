import type { Attachment, Message } from 'chat';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { transcribeVoiceClips } from './voice-clips.js';

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

function voiceClip(overrides: Partial<Attachment> = {}): Attachment {
  return {
    type: 'audio',
    name: 'audio_message.m4a',
    mimeType: 'audio/mp4',
    size: 15,
    fetchData: async () => Buffer.from('fake aac bytes'),
    ...overrides,
  };
}

function message(id: string, attachments: Attachment[]): Message {
  return { id, text: '', attachments } as unknown as Message;
}

async function transcriptOf(msg: Message): Promise<{ name?: string; text: string }> {
  const transcript = msg.attachments.find(a => a.mimeType === 'text/plain');
  if (!transcript?.fetchData) throw new Error('no transcript attachment');
  return { name: transcript.name, text: (await transcript.fetchData()).toString('utf8') };
}

describe('transcribeVoiceClips', () => {
  it("transcribes a clip with the sender's saved model and key, keeping the clip", async () => {
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

    expect(msg.attachments[0]).toBe(clip);
    expect(await transcriptOf(msg)).toEqual({ name: 'audio_message.m4a (transcript)', text: 'ship the fix' });
    expect(calls.openai).toEqual([]);
    expect(calls.mistral).toEqual([
      { authorization: 'Bearer sk-mistral', model: 'voxtral-mini-latest', filename: expect.stringMatching(/\.m4a$/) },
    ]);
  });

  it("falls back to the org's key when the sender has none", async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'openai-codex', { type: 'api_key', key: 'sk-org' });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], SENDER, {
      modelCredentials: seed.credentials,
      voiceSettings: seed.voiceSettings,
    });

    expect((await transcriptOf(msg)).text).toBe('hello from whisper');
    expect(calls.openai.map(c => c.authorization)).toEqual(['Bearer sk-org']);
  });

  it('transcribes clips from earlier messages batched into the same run', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const earlier = message('m1', [voiceClip()]);
    const latest = message('m2', [voiceClip({ name: 'second.m4a' })]);

    await transcribeVoiceClips([earlier, latest], SENDER, { modelCredentials: seed.credentials });

    expect((await transcriptOf(earlier)).text).toBe('ship the fix');
    expect((await transcriptOf(latest)).name).toBe('second.m4a (transcript)');
    expect(calls.mistral).toHaveLength(2);
  });

  it('notes a missing speech-to-text key without calling a provider', async () => {
    const seed = await createFactoryStorageForTests();
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect((await transcriptOf(msg)).text).toMatch(/^Not transcribed: .*API key/);
    expect(calls.openai).toEqual([]);
    expect(calls.mistral).toEqual([]);
  });

  it('notes an unlinked sender instead of using anyone else’s key', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mistral', { type: 'api_key', key: 'sk-org' });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], undefined, { modelCredentials: seed.credentials });

    expect((await transcriptOf(msg)).text).toContain('linked Mastra account');
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

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect((await transcriptOf(msg)).text).toContain('too long');
    expect(downloaded).toBe(false);
    expect(calls.mistral).toEqual([]);
  });

  it('surfaces a provider failure as a note on the clip', async () => {
    server.use(http.post(MISTRAL_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect((await transcriptOf(msg)).text).toMatch(/^Not transcribed: /);
  });

  it('leaves messages without voice clips untouched', async () => {
    const seed = await createFactoryStorageForTests();
    const image: Attachment = { type: 'image', mimeType: 'image/png', name: 'shot.png' };
    const msg = message('m1', [image]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([image]);
  });
});
