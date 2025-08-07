import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const MAX_TEXT_LENGTH = 4000;

export const generateAudioFromTextTool = createTool({
  id: 'generate-audio-from-text-tool',
  description: 'Generates high-quality audio from text content using voice synthesis',
  inputSchema: z.object({
    extractedText: z.string().describe('The extracted text to generate audio from'),
    speaker: z.string().optional().describe('Voice speaker to use (default: nova)'),
    speed: z.number().optional().describe('Speaking speed (0.25 to 4.0, default: 1.0)'),
  }),
  outputSchema: z.object({
    audioGenerated: z.boolean().describe('Whether audio generation was successful'),
    textLength: z.number().describe('Length of text processed'),
    estimatedDuration: z.number().describe('Estimated audio duration in seconds'),
    audioInfo: z.object({
      format: z.string().describe('Audio format (e.g., mp3)'),
      quality: z.string().describe('Audio quality setting'),
      speaker: z.string().describe('Voice speaker used'),
    }),
    success: z.boolean().describe('Whether audio generation was successful'),
  }),
  execute: async ({ context, mastra }) => {
    const { extractedText, speaker = 'nova', speed = 1.0 } = context;

    console.log('🎙️ Generating audio from extracted text...');

    if (!extractedText || extractedText.trim() === '') {
      console.error('❌ No extracted text provided for audio generation');
      return {
        audioGenerated: false,
        textLength: 0,
        estimatedDuration: 0,
        audioInfo: {
          format: 'none',
          quality: 'none',
          speaker: 'none',
        },
        success: false,
      };
    }

    // Simple check for very large documents
    let processedText = extractedText;
    if (extractedText.length > MAX_TEXT_LENGTH) {
      console.warn('⚠️ Document is very large. Truncating to avoid processing limits.');
      console.warn(`⚠️ Using first ${MAX_TEXT_LENGTH} characters only...`);
      processedText = extractedText.substring(0, MAX_TEXT_LENGTH);
    }

    try {
      const agent = mastra?.getAgent('textToAudioAgent');
      if (!agent) {
        throw new Error('Text-to-audio agent not found');
      }

      // Check if agent has voice capabilities
      if (!agent.voice) {
        throw new Error('Agent does not have voice synthesis capabilities');
      }

      console.log(`🎵 Converting text to audio using ${speaker} voice...`);

      // Generate audio using the agent's voice synthesis
      const audioStream = await agent.voice.speak(processedText, {
        speaker,
        speed,
      });

      // Estimate duration (roughly 150 words per minute average speaking rate)
      const wordCount = processedText.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60); // Convert to seconds

      console.log(`✅ Audio generation successful: ~${estimatedDuration} seconds duration`);

      return {
        audioGenerated: true,
        textLength: processedText.length,
        estimatedDuration,
        audioInfo: {
          format: 'mp3',
          quality: 'hd',
          speaker,
        },
        success: true,
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
        textLength: processedText.length,
        estimatedDuration: 0,
        audioInfo: {
          format: 'none',
          quality: 'none',
          speaker: 'none',
        },
        success: false,
      };
    }
  },
});
