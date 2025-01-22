import { ElevenLabsTTS } from '@mastra/tts';
import { writeFileSync } from 'fs';
import path from 'path';

export async function generateAudio(
  tts: ElevenLabsTTS,
  text: string,
  voiceId: string,
  paddedIndex: string,
): Promise<void> {
  try {
    const { audioResult } = await tts.generate({
      text,
      voice: voiceId,
    });

    const outputPath = path.join(process.cwd(), `audio/voice-${paddedIndex}.mp3`);

    writeFileSync(outputPath, audioResult);
  } catch (error) {
    console.log(error);
  }
}
