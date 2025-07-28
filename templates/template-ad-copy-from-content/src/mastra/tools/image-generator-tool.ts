import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { experimental_generateImage as generateImage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

// Initialize S3 client for AWS S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'mastra-generated-images';
const PUBLIC_URL_BASE = process.env.S3_PUBLIC_URL_BASE || `https://${BUCKET_NAME}.s3.amazonaws.com`;

// Helper function to upload image to cloud storage
async function uploadImageToStorage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const imageId = randomUUID();
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `generated-images/${imageId}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: mimeType,
  });

  try {
    await s3Client.send(command);
    const publicUrl = `${PUBLIC_URL_BASE}/${key}`;
    console.log(`✅ Image uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to upload image to storage:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const imageGeneratorTool = createTool({
  id: 'image-generator',
  description:
    'Generates promotional images using DALL-E 3 and uploads them to cloud storage, returning the public URL',
  inputSchema: z.object({
    prompt: z.string().describe('Description of the image to generate'),
    style: z
      .enum(['photographic', 'digital_art', 'illustration', 'minimalist', 'vintage', 'modern'])
      .optional()
      .default('minimalist'),
    platform: z.enum(['facebook', 'instagram', 'linkedin', 'twitter', 'generic']).optional().default('generic'),
    size: z.enum(['480x480', '1024x1024', '1792x1024', '1024x1792']).optional().default('480x480'),
  }),
  outputSchema: z.object({
    imageUrl: z.string().describe('Public URL of the uploaded image in cloud storage'),
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
      const enhancedPrompt = `Create a ${style} promotional image optimized for ${platform}.

      Original concept: ${prompt}

      Style requirements:
      - ${style} visual style
      - high-quality, professional appearance
      - Suitable for advertising and marketing use
      - Eye-catching and engaging composition
      - Brand-appropriate aesthetic
      - Strong visual hierarchy`;

      // Generate image using the AI package
      const { image } = await generateImage({
        model: openai.image('dall-e-3'),
        prompt: enhancedPrompt,
        size: size,
      });

      console.log('✅ Image generated successfully with AI package');

      // Convert base64 to buffer for upload
      const imageBuffer = Buffer.from(image.base64, 'base64');

      // Upload to cloud storage and get public URL
      const publicImageUrl = await uploadImageToStorage(imageBuffer, image.mimeType);

      return {
        imageUrl: publicImageUrl,
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
