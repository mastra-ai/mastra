import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';

export const imageGeneratorTool = createTool({
  id: 'image-generator',
  description: 'Generates promotional images using DALL-E 3 via the AI package, returning the direct URL',
  inputSchema: z.object({
    prompt: z.string().describe('Description of the image to generate'),
    style: z.enum(['photographic', 'digital_art', 'illustration', 'minimalist', 'vintage', 'modern']).optional().default('modern'),
    platform: z.enum(['facebook', 'instagram', 'linkedin', 'twitter', 'generic']).optional().default('generic'),
    size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional().default('1024x1024'),
  }),
  outputSchema: z.object({
    imageUrl: z.string().describe('Direct URL of the generated image'),
    revisedPrompt: z.string().describe('The enhanced prompt used for generation'),
    generatedAt: z.string().describe('Timestamp of when the image was generated'),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { prompt, style, platform, size } = context;

    console.log(`🎨 Generating image with DALL-E 3 via AI package: "${prompt.substring(0, 50)}..."`);

    try {
      // Build enhanced prompt based on parameters
      const platformDimensions = {
        facebook: { width: 1200, height: 630, ratio: '1.91:1' },
        instagram: { width: 1080, height: 1080, ratio: '1:1' },
        linkedin: { width: 1200, height: 627, ratio: '1.91:1' },
        twitter: { width: 1200, height: 675, ratio: '16:9' },
        generic: { width: 1024, height: 1024, ratio: '1:1' }
      };

      const dimensions = platformDimensions[platform];

      const enhancedPrompt = `Create a ${style} promotional image optimized for ${platform}.

      Original concept: ${prompt}

      Style requirements:
      - ${style} visual style
      - High-quality, professional appearance
      - Suitable for advertising and marketing use
      - Eye-catching and engaging composition
      - Optimized for ${platform} (${dimensions.ratio} aspect ratio)
      - Brand-appropriate aesthetic
      - Strong visual hierarchy`;

      // Generate image using the AI package
      const { image } = await generateImage({
        model: openai.image('dall-e-3'),
        prompt: enhancedPrompt,
        size: size,
      });

      // Convert the image to a data URL
      const imageUrl = `data:${image.mimeType};base64,${image.base64}`;

      console.log('✅ Image generated successfully with AI package');

      return {
        imageUrl: imageUrl,
        revisedPrompt: enhancedPrompt,
        generatedAt: new Date().toISOString(),
        dimensions: {
          width: parseInt(size.split('x')[0]),
          height: parseInt(size.split('x')[1]),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Image generation failed:', errorMessage);
      throw new Error(`Failed to generate image: ${errorMessage}`);
    }
  },
});
