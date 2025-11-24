import { openai } from '@ai-sdk/openai';
import { openai as openaiV5 } from '@ai-sdk/openai-v5';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { Agent } from '../agent';

config();

export function imagePromptTest({ version }: { version: 'v1' | 'v2' }) {
  const openaiModel = version === 'v1' ? openai('gpt-4o') : openaiV5('gpt-4o');

  describe('image prompt test', () => {
    it('should download assets from messages', { timeout: 100000, retry: 3 }, async () => {
      const agent = new Agent({
        name: 'llmPrompt-agent',
        instructions: 'test agent',
        model: openaiModel,
      });

      let result;

      if (version === 'v1') {
        result = await agent.generateLegacy([
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                mimeType: 'image/png',
              },
              {
                type: 'text',
                text: 'What is the photo?',
              },
            ],
          },
        ]);
      } else {
        result = await agent.generate([
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
                mimeType: 'image/png',
              },
              {
                type: 'text',
                text: 'What is the photo?',
              },
            ],
          },
        ]);
      }

      expect(result.text.toLowerCase()).toContain('google');
    });
  });
}

imagePromptTest({ version: 'v1' });
imagePromptTest({ version: 'v2' });
