import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs, { createWriteStream } from 'fs';
import path from 'path';

const MAX_TEXT_LENGTH = 4000;

const saveAudioToFile = async (audio: any, filename: string): Promise<void> => {
  const audioDir = path.join(process.cwd(), 'audio');
  const filePath = path.join(audioDir, filename);

  await fs.promises.mkdir(audioDir, { recursive: true });
  // TypeScript assertion - we know this will work (probably)
  const audioStream = audio as { pipe: (writer: any) => void };
  const writer = createWriteStream(filePath);
  audioStream.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

export const textToSpeechTool = createTool({
  id: 'textToSpeechTool',
  description: 'Generates high-quality audio from text content using voice synthesis',
  inputSchema: z.object({
    extractedText: z.string().describe('The extracted text to generate audio from'),
    speaker: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional().default('onyx'),
    speed: z.number().min(0.1).max(4).optional().default(1),
  }),
  outputSchema: z.object({
    audioGenerated: z.boolean().describe('Whether audio generation was successful'),
    filePath: z.string().optional().describe('Path to the generated audio file'),
    speaker: z.string().describe('Voice speaker that was used for audio generation'),
    speed: z.number().describe('Speaking speed that was used for audio generation'),
  }),
  execute: async ({ context, mastra }) => {
    const { extractedText } = context;

    console.log('🎙️ Generating audio from extracted text...');

    if (!extractedText || extractedText.trim() === '') {
      throw new Error('No extracted text provided for audio generation');
    }

    // Simple check for very large documents
    let processedText = extractedText;
    if (extractedText.length > MAX_TEXT_LENGTH) {
      console.warn('⚠️ Document is very large. Truncating to avoid processing limits.');
      console.warn(`⚠️ Using first ${MAX_TEXT_LENGTH} characters only...`);
      processedText = extractedText.substring(0, MAX_TEXT_LENGTH);
    }

    try {
      console.log(`🎵 Converting text to audio...`);
      const textNaturalizerAgent = mastra!.getAgent('textNaturalizerAgent');
      console.log('extToAudioAgent.voice', textNaturalizerAgent.voice);

      // Generate audio using the agent's voice synthesis
      const audioStream = await textNaturalizerAgent.voice.speak(processedText, {
        speaker: context.speaker,
        speed: context.speed,
      });

      // Check if we got a valid audio stream
      if (!audioStream) {
        throw new Error('No audio stream returned from voice synthesis');
      }

      // Save the audio to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `audio-${timestamp}.mp3`;
      await saveAudioToFile(audioStream, filename);
      console.log(`💾 Audio saved to: ${filename}`);

      console.log(`✅ Audio generation successful`);

      return {
        audioGenerated: true,
        filePath: path.join(process.cwd(), 'audio', filename),
        speaker: context.speaker,
        speed: context.speed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Audio generation failed:', errorMessage);

      // Check if it's a text length error
      if (errorMessage.includes('length') || errorMessage.includes('limit')) {
        console.error('💡 Tip: Try using a smaller text input. Large texts may exceed processing limits.');
      }

      return {
        audioGenerated: false,
        speaker: context.speaker,
        speed: context.speed,
      };
    }
  },
});
