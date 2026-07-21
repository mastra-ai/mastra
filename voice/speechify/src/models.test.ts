import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SpeechifyVoice } from './index';

const { audioStreamMock } = vi.hoisted(() => ({
  audioStreamMock: vi.fn(),
}));

vi.mock('@speechify/api-sdk', () => ({
  Speechify: class {
    audioStream = audioStreamMock;
  },
}));

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('SpeechifyVoice model support', () => {
  beforeEach(() => {
    audioStreamMock.mockReset();
    audioStreamMock.mockResolvedValue(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    );
  });

  it('passes simba-3.2 from the constructor config to the API', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-3.2', apiKey: 'test-key' } });
    const audio = await drain(await voice.speak('Hello'));

    expect(audio.length).toBeGreaterThan(0);
    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'simba-3.2' }));
  });

  it('passes simba-3.2 as a per-request override', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    await drain(await voice.speak('Hello', { model: 'simba-3.2' }));

    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'simba-3.2' }));
  });

  it('accepts simba-3.0', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-3.0', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello'));

    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'simba-3.0' }));
  });

  it('still defaults to simba-english', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    await drain(await voice.speak('Hello'));

    expect(audioStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'simba-english', voiceId: 'george' }),
    );
  });
});

describe('SpeechifyVoice Simba 3 voice pairing', () => {
  beforeEach(() => {
    audioStreamMock.mockReset();
    audioStreamMock.mockResolvedValue(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    );
  });

  it('accepts a curated Simba 3 voice as the constructor speaker', async () => {
    const voice = new SpeechifyVoice({
      speechModel: { name: 'simba-3.2', apiKey: 'test-key' },
      speaker: 'harper_32',
    });
    await drain(await voice.speak('Hello'));

    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ model: 'simba-3.2', voiceId: 'harper_32' }));
  });

  it('defaults the speaker to harper_32 when a Simba 3 model is configured', async () => {
    const voice = new SpeechifyVoice({ speechModel: { name: 'simba-3.2', apiKey: 'test-key' } });
    await drain(await voice.speak('Hello'));

    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'harper_32' }));
  });

  it('keeps an explicit speaker over the model-based default', async () => {
    const voice = new SpeechifyVoice({
      speechModel: { name: 'simba-3.0', apiKey: 'test-key' },
      speaker: 'wyatt_32',
    });
    await drain(await voice.speak('Hello'));

    expect(audioStreamMock).toHaveBeenCalledWith(expect.objectContaining({ voiceId: 'wyatt_32' }));
  });

  it('lists the curated Simba 3 voices in getSpeakers', async () => {
    const voice = new SpeechifyVoice({ speechModel: { apiKey: 'test-key' } });
    const speakers = await voice.getSpeakers();
    const ids = speakers.map(s => s.voiceId);

    expect(ids).toContain('harper_32');
    expect(ids).toContain('wyatt_32');
    expect(ids).toContain('george');
  });
});
