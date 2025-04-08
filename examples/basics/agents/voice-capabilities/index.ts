// Import required dependencies
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIVoice } from '@mastra/voice-openai';
import { createReadStream, createWriteStream } from 'fs';
import { PlayAIVoice } from '@mastra/voice-playai';
import path from 'path';

// Initialize Agent 1 with both listening and speaking capabilities
const agent1 = new Agent({
  name: 'Agent1',
  instructions: `You are an agent with both STT and TTS capabilities.`,
  model: openai('gpt-4o'),
  voice: new CompositeVoice({
    input: new OpenAIVoice(), // For converting speech to text
    output: new PlayAIVoice(), // For converting text to speech
  }),
});

// Initialize Agent 2 with just OpenAI for both listening and speaking capabilities
const agent2 = new Agent({
  name: 'Agent2',
  instructions: `You are an agent with both STT and TTS capabilities.`,
  model: openai('gpt-4o'),
  voice: new OpenAIVoice(),
});

// Step 1: Agent 1 speaks a question and saves it to a file
const audio1 = await agent1.voice.speak('What is the meaning of life in one sentence?');
await saveAudioToFile(audio1, 'agent1-question.mp3');

// Step 2: Agent 2 listens to Agent 1's question
const audioFilePath = path.join(process.cwd(), 'agent1-question.mp3');
const audioStream = createReadStream(audioFilePath);
const audio2 = await agent2.voice.listen(audioStream);
const text = await convertToText(audio2);

// Step 3: Agent 2 generates and speaks a response
const agent2Response = await agent2.generate(text);
const agent2ResponseAudio = await agent2.voice.speak(agent2Response.text);
await saveAudioToFile(agent2ResponseAudio, 'agent2-response.mp3');

/**
 * Saves an audio stream to a file
 */
async function saveAudioToFile(audio: NodeJS.ReadableStream, filename: string): Promise<void> {
  const filePath = path.join(process.cwd(), filename);
  const writer = createWriteStream(filePath);
  audio.pipe(writer);
  return new Promise<void>((resolve, reject) => {
    writer.on('finish', () => resolve());
    writer.on('error', reject);
  });
}

/**
 * Converts either a string or a readable stream to text
 */
async function convertToText(input: string | NodeJS.ReadableStream): Promise<string> {
  if (typeof input === 'string') {
    return input;
  }

  const chunks: Buffer[] = [];
  return new Promise<string>((resolve, reject) => {
    input.on('data', chunk => chunks.push(Buffer.from(chunk)));
    input.on('error', err => reject(err));
    input.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}
