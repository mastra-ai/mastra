import NodeMic from 'node-mic';
import { Readable } from 'stream';
import { mastra } from './mastra';
import AudioPlayer from './utils/speaker';

let mic: NodeMic | null = null;
let audioBuffer = Buffer.alloc(0);
const chunkSize = 4800;

async function main() {
  const agent = mastra.getAgent('CafeAgent');
  const player = new AudioPlayer({
    channels: 1,
    bitDepth: 16,
    sampleRate: 24000,
  });

  // Set up event handlers for the agent
  agent.voice?.on('speaking', ({ audio }) => {
    mic?.pause();

    if (audio) {
      player.playAudio(audio); // Stream audio to speakers.
    }
    mic?.resume();
  });

  agent.voice?.on('writing', ({ text, role }) => {
    console.log(`listen:`, text, role);
  });

  agent.voice?.on('error', error => {
    console.error('Error:', error);
  });

  // Connect to the agent
  await agent.voice?.connect();
  startAudio();

  await agent.voice?.speak(`Hello! Welcome to All Star Cafe. Would you like to place an order?`);

  function startAudio() {
    try {
      mic = new NodeMic({
        rate: 16000,
        channels: 1,
        threshold: 0.5,
      });

      const micInputStream = mic!.getAudioStream();
      micInputStream.on('data', (data: Buffer) => {
        audioBuffer = Buffer.concat([audioBuffer, data]);

        while (audioBuffer.length >= chunkSize) {
          const chunk = audioBuffer.subarray(0, chunkSize);
          audioBuffer = audioBuffer.subarray(chunkSize);

          const readableStream = new Readable({
            read() {},
          });

          readableStream.push(chunk);
          readableStream.push(null);
          try {
            // Stream audio to OpenAI Realtime
            agent.voice?.send(readableStream);
          } catch (err) {
            console.error('Error sending audio data:', err);
          }
        }
      });

      mic!.start();
    } catch (error) {
      console.error('Error starting audio:', error);
    }
  }
}

await main();
