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
  const key = `flashcard-images/${imageId}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: imageBuffer,
    ContentType: mimeType,
  });

  try {
    await s3Client.send(command);
    const publicUrl = `${PUBLIC_URL_BASE}/${key}`;
    console.log(`✅ Educational image uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('❌ Failed to upload image to storage:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const educationalImageTool = createTool({
  id: 'educational-image-generator',
  description:
    'Generates educational images for flash cards using DALL-E 3 and uploads them to cloud storage, returning the public URL',
  inputSchema: z.object({
    concept: z.string().describe('Educational concept or topic to visualize'),
    subjectArea: z.string().describe('Subject area (e.g., biology, chemistry, history, mathematics)'),
    style: z
      .enum(['educational', 'diagram', 'illustration', 'realistic', 'minimalist', 'scientific'])
      .optional()
      .default('educational'),
    complexity: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
    size: z.enum(['480x480', '1024x1024', '1792x1024']).optional().default('1024x1024'),
  }),
  outputSchema: z.object({
    imageUrl: z.string().describe('Public URL of the uploaded educational image in cloud storage'),
    revisedPrompt: z.string().describe('The enhanced prompt used for generation'),
    generatedAt: z.string().describe('Timestamp of when the image was generated'),
    dimensions: z.object({
      width: z.number(),
      height: z.number(),
    }),
  }),
  execute: async ({ context }) => {
    const { concept, subjectArea, style, complexity, size } = context;

    console.log(`🎨 Generating educational image for concept: "${concept.substring(0, 50)}..."`);

    try {
      const enhancedPrompt = `Create a ${style} educational image for ${subjectArea} at ${complexity} level that will enhance learning and memory retention.

      Educational Concept: ${concept}

      Design Requirements:
      - NO TEXT OR WORDS in the image - purely visual representation
      - ${style} visual style appropriate for educational flash cards
      - Clear, informative, and pedagogically sound design
      - Optimized for ${complexity} level learners
      - Clean, focused composition that highlights the core concept
      - Professional educational illustration quality
      - Subject area: ${subjectArea}
      - Visual should immediately suggest the educational concept
      - Use colors and design elements that enhance memory formation
      - Create visual associations that support learning objectives
      - Make the image memorable and distinctive for effective recall
      - Ensure cultural sensitivity and universal accessibility
      
      The image should serve as a powerful visual mnemonic that helps students immediately recall and understand the concept when studying their flash cards.`;

      // Generate image using the AI package
      const { image } = await generateImage({
        model: openai.image('dall-e-3'),
        prompt: enhancedPrompt,
        size: size,
      });

      console.log('✅ Educational image generated successfully with AI package');

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
      console.error('❌ Educational image generation failed:', errorMessage);
      throw new Error(`Failed to generate educational image: ${errorMessage}`);
    }
  },
});
