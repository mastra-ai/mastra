import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { OpenAIVoice } from '@mastra/voice-openai';

export const generateAudioFromTextTool = createTool({
  id: 'generate-audio-from-text-tool',
  description: 'Converts text content into high-quality audio using OpenAI text-to-speech',
  inputSchema: z.object({
    text: z.string().describe('Text content to convert to audio'),
    voice: z
      .string()
      .optional()
      .describe('Voice to use for speech synthesis (alloy, echo, fable, onyx, nova, shimmer)'),
    speed: z.number().optional().describe('Speech speed (0.25-4.0, default: 1.0)'),
  }),
  outputSchema: z.object({
    audioStream: z.any().describe('Audio stream containing the generated speech'),
    duration: z.number().optional().describe('Estimated duration of the audio in seconds'),
    success: z.boolean().describe('Indicates if the audio generation was successful'),
    voice: z.string().describe('Voice used for the audio generation'),
  }),
  execute: async ({ context, mastra }) => {
    const { text, voice = 'alloy', speed = 1.0 } = context;

    console.log('🎙️ Generating audio from text...');
    console.log(`📝 Text length: ${text.length} characters`);
    console.log(`🗣️ Voice: ${voice}`);
    console.log(`⚡ Speed: ${speed}x`);

    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Input text is empty');
      }

      // Get the audio generation agent or create a voice instance
      const audioGenerationAgent = mastra?.getAgent('audioGenerationAgent');
      let audioStream;

      if (audioGenerationAgent && audioGenerationAgent.voice) {
        // Use the agent's voice if available
        console.log('🎯 Using audio generation agent voice...');
        audioStream = await audioGenerationAgent.voice.speak(text, {
          speaker: voice,
          speed: speed,
        });
      } else {
        // Fallback to creating a new OpenAI voice instance
        console.log('🔄 Creating new OpenAI voice instance...');
        const openAIVoice = new OpenAIVoice({
          speechModel: { name: 'tts-1-hd', apiKey: process.env.OPENAI_API_KEY },
          speaker: voice,
        });

        audioStream = await openAIVoice.speak(text, {
          speaker: voice,
          speed: speed,
        });
      }

      if (!audioStream) {
        throw new Error('Failed to generate audio stream');
      }

      // Estimate duration (rough calculation: ~150 words per minute for average speech)
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.ceil(((wordCount / 150) * 60) / speed);

      console.log(`✅ Generated audio successfully`);
      console.log(`⏱️ Estimated duration: ${estimatedDuration} seconds`);

      return {
        audioStream,
        duration: estimatedDuration,
        success: true,
        voice: voice,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Audio generation failed:', errorMessage);

      return {
        audioStream: null,
        duration: 0,
        success: false,
        voice: voice,
      };
    }
  },
});
