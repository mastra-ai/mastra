import { writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';

import { CambVoice } from './index';

/**
 * E2E test: Mastra Agent with CambVoice
 *
 * Tests the full integration of CambVoice as a voice provider on a Mastra Agent,
 * simulating a chatbot that generates responses and speaks them aloud.
 *
 * Requires: CAMB_API_KEY and OPENAI_API_KEY environment variables
 */
describe('CambVoice E2E - Agent Chatbot', () => {
  const outputDir = path.join(process.cwd(), 'test-outputs');
  let mastra: Mastra;

  beforeAll(() => {
    mkdirSync(outputDir, { recursive: true });

    const cambVoice = new CambVoice({
      speechModel: {
        name: 'mars-pro',
      },
    });

    const chatbot = new Agent({
      id: 'chatbot',
      name: 'chatbot',
      instructions: 'You are a friendly assistant. Keep responses under 50 words.',
      model: 'openai/gpt-4.1-mini',
      voice: cambVoice,
    });

    mastra = new Mastra({
      agents: { chatbot },
    });
  });

  it('should get the agent and access its voice', async () => {
    const agent = mastra.getAgent('chatbot');
    expect(agent).toBeDefined();
    expect(agent.voice).toBeDefined();
  });

  it('should list speakers through the agent voice', async () => {
    const agent = mastra.getAgent('chatbot');
    const speakers = await agent.voice!.getSpeakers();
    expect(speakers.length).toBeGreaterThan(0);
    expect(speakers[0]).toHaveProperty('voiceId');
    expect(speakers[0]).toHaveProperty('name');
  }, 30000);

  it('should generate a response and speak it', async () => {
    const agent = mastra.getAgent('chatbot');

    // Generate a text response from the agent
    const response = await agent.generate('Say hello and introduce yourself in one sentence.');
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);

    // Speak the agent response using Camb voice
    const audioStream = await agent.voice!.speak(response.text);
    expect(audioStream).toHaveProperty('pipe');

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    // Verify valid WAV audio
    expect(audioBuffer.length).toBeGreaterThan(44);
    expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');
    expect(audioBuffer.toString('ascii', 8, 12)).toBe('WAVE');

    // Verify sample rate is 48000 for mars-pro
    const sampleRate = audioBuffer.readUInt32LE(24);
    expect(sampleRate).toBe(48000);

    await writeFile(path.join(outputDir, 'e2e-chatbot-response.wav'), audioBuffer);
  }, 60000);

  it('should handle a multi-turn conversation with voice output', async () => {
    const agent = mastra.getAgent('chatbot');

    // First turn
    const first = await agent.generate('What is the capital of France? Answer in one sentence.');
    expect(first.text).toBeDefined();

    // Second turn - follow-up
    const second = await agent.generate('What language do they speak there? Answer in one sentence.');
    expect(second.text).toBeDefined();

    // Speak the final response
    const audioStream = await agent.voice!.speak(second.text);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    expect(audioBuffer.length).toBeGreaterThan(44);
    expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');

    await writeFile(path.join(outputDir, 'e2e-chatbot-multiturn.wav'), audioBuffer);
  }, 60000);

  it('should report listener as disabled (TTS-only provider)', async () => {
    const agent = mastra.getAgent('chatbot');

    const listener = await agent.voice!.getListener();
    expect(listener).toEqual({ enabled: false });

    const dummyStream = (async function* () {
      yield Buffer.from('dummy');
    })();
    await expect(agent.voice!.listen(dummyStream)).rejects.toThrow('Camb AI does not support speech recognition');
  });

  it('should speak with a specific speaker from getSpeakers', async () => {
    const agent = mastra.getAgent('chatbot');

    // Get available speakers and pick one
    const speakers = await agent.voice!.getSpeakers();
    const speaker = speakers[0]!.voiceId;

    const response = await agent.generate('Tell me a fun fact in one sentence.');

    const audioStream = await agent.voice!.speak(response.text, { speaker });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    expect(audioBuffer.length).toBeGreaterThan(44);
    await writeFile(path.join(outputDir, 'e2e-chatbot-speaker.wav'), audioBuffer);
  }, 60000);

  it('should handle a short agent response within CambVoice bounds (>= 3 chars)', async () => {
    const agent = mastra.getAgent('chatbot');

    const response = await agent.generate('Reply with exactly one short word.');
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThanOrEqual(3);

    const audioStream = await agent.voice!.speak(response.text);
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    const audioBuffer = Buffer.concat(chunks);

    expect(audioBuffer.length).toBeGreaterThan(44);
    expect(audioBuffer.toString('ascii', 0, 4)).toBe('RIFF');

    await writeFile(path.join(outputDir, 'e2e-chatbot-short-response.wav'), audioBuffer);
  }, 60000);
});
