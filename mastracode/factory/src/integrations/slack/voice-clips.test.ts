import type { ChannelHandler } from '@mastra/core/channels';
import { stringifyMarkdown } from 'chat';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { factoryProjectSettingsUserId } from '../../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../../storage/test-utils.js';
import { transcribeVoiceClips } from './voice-clips.js';

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
    const clip = voiceClip();
    const msg = message('m1', [clip]);

    await transcribeVoiceClips(
      [msg],
      SENDER,
      { modelCredentials: seed.credentials, voiceSettings: seed.voiceSettings },
      async () => project,
    );

    expect(msg.attachments).toEqual([clip]);
    expect(agentReads(msg)).toMatch(/^Voice clip "audio_message.m4a" not transcribed: .*API key/);
    expect(calls.openai).toEqual([]);
  });

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
      async () => project,
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

  it('keeps the clip and notes a missing speech-to-text key without calling a provider', async () => {
    const seed = await createFactoryStorageForTests();
    const clip = voiceClip();
    const msg = message('m1', [clip]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments).toEqual([clip]);
    expect(agentReads(msg)).toMatch(/^Voice clip "audio_message.m4a" not transcribed: .*API key/);
    expect(calls.openai).toEqual([]);
    expect(calls.mistral).toEqual([]);
  });

  it('notes an unlinked sender instead of using anyone else’s key', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential({ orgId: 'org1' }, 'mistral', { type: 'api_key', key: 'sk-org' });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], undefined, { modelCredentials: seed.credentials });

    expect(agentReads(msg)).toContain('linked Mastra account');
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

    expect(agentReads(msg)).toContain('too long');
    expect(downloaded).toBe(false);
    expect(calls.mistral).toEqual([]);
  });

  it('notes a clip of unknown size whose download turns out over the cap, without calling a provider', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip({ size: undefined, fetchData: async () => Buffer.alloc(9 * 1024 * 1024) })]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(agentReads(msg)).toContain('too long');
    expect(calls.mistral).toEqual([]);
  });

  it('notes a clip Slack offers no download for', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip({ fetchData: undefined })]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(agentReads(msg)).toContain('could not be downloaded');
  });

  it('names each clip in its note so a message with several clips stays unambiguous', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [
      voiceClip({ name: 'standup.m4a' }),
      voiceClip({ name: 'huge.m4a', size: 50 * 1024 * 1024 }),
    ]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(msg.attachments.map(clip => clip.name)).toEqual(['huge.m4a']);
    expect(agentReads(msg)).toContain('ship the fix');
    expect(agentReads(msg)).toMatch(/"huge\.m4a".*too long/);
  });

  it('surfaces a provider failure as a note on the clip', async () => {
    server.use(http.post(MISTRAL_URL, () => HttpResponse.json({ message: 'boom' }, { status: 500 })));
    const seed = await createFactoryStorageForTests();
    await seed.credentials.setCredential(SENDER, 'mistral', { type: 'api_key', key: 'sk-mistral' });
    const msg = message('m1', [voiceClip()]);

    await transcribeVoiceClips([msg], SENDER, { modelCredentials: seed.credentials });

    expect(agentReads(msg)).toMatch(/^Voice clip "audio_message.m4a" not transcribed: .*Status 500/);
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
