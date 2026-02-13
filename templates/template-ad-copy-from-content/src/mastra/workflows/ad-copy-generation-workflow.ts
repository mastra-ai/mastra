import { createWorkflow, createStep, mapVariable } from '@mastra/core/workflows';
import { z } from 'zod';
import { RequestContext } from '@mastra/core/di';
import { pdfContentExtractorTool } from '../tools/pdf-content-extractor-tool';
import { adCopyGeneratorTool } from '../tools/ad-copy-generator-tool';
import { imageGeneratorTool } from '../tools/image-generator-tool';

const inputSchema = z.object({
  contentInput: z.string().describe('Either plain text content, PDF URL, or website URL'),
  inputType: z.enum(['text', 'pdf', 'url']).describe('Type of input provided'),
  platform: z
    .enum(['facebook', 'google', 'instagram', 'linkedin', 'twitter', 'tiktok', 'generic'])
    .optional()
    .default('generic')
    .describe('Target advertising platform'),
  campaignType: z
    .enum(['awareness', 'consideration', 'conversion', 'retention'])
    .optional()
    .default('consideration')
    .describe('Campaign objective'),
  targetAudience: z.string().optional().describe('Description of target audience'),
  tone: z
    .enum(['professional', 'casual', 'playful', 'urgent', 'inspirational', 'authoritative'])
    .optional()
    .default('professional')
    .describe('Tone of voice'),
  productType: z.string().optional().describe('Type of product or service'),
  generateImages: z.boolean().optional().default(true).describe('Whether to generate promotional images'),
  imageStyle: z
    .enum(['photographic', 'digital_art', 'illustration', 'minimalist', 'vintage', 'modern'])
    .optional()
    .default('modern')
    .describe('Style for generated images'),
});

const outputSchema = z.object({
  adCopy: z.object({
    headline: z.string(),
    body: z.string(),
    cta: z.string(),
  }),
  imageUrl: z.string().optional(),
});

// Step 1: Extract content from PDF, URL, or use provided text
const extractContentStep = createStep({
  id: 'extract-content',
  description: 'Extract and process content from PDF, website URL, or plain text input',
  inputSchema: inputSchema,
  outputSchema: z.object({
    processedContent: z.string(),
    extractedData: z
      .object({
        marketingSummary: z.string(),
        keyPoints: z.array(z.string()),
        targetAudience: z.string().optional(),
        valueProposition: z.string().optional(),
        fileSize: z.number().optional(),
        pagesCount: z.number().optional(),
        characterCount: z.number().optional(),
      })
      .optional(),
  }),
  execute: async ({ inputData, requestContext, mastra }) => {
    const { contentInput, inputType } = inputData;

    console.log(`📝 Processing ${inputType} content...`);

    if (inputType === 'url') {
      console.log('🌐 Extracting content from website URL...');

      try {
        // Import mastra instance directly since request context access is complex in workflows
        const webContentAgent = mastra.getAgent('webContentAgent');

        // Use the agent to extract content
        const response = await webContentAgent.generate([
          {
            role: 'user',
            content: `Please extract the complete content from this URL for marketing ad copy generation: ${contentInput}

          Focus on text content only.

          Make sure to capture:
          - The complete article/blog post content
          - Key value propositions and benefits
          - Any product/service features mentioned
          - Target audience information
          - Supporting evidence or testimonials

          This content will be used to generate compelling ad copy, so be thorough and marketing-focused.`,
          },
        ]);

        const extractedContent = response.text;

        // Parse the extracted content to create marketing summary
        const lines = extractedContent.split('\n').filter((line: string) => line.trim());
        const summaryMatch = lines.find((line: string) => line.includes('Summary:') || line.includes('summary:'));

        const marketingSummary = summaryMatch
          ? summaryMatch.replace(/Summary:\s*/i, '')
          : extractedContent.substring(0, 500) + '...';

        return {
          processedContent: extractedContent,
          extractedData: {
            marketingSummary,
            keyPoints: ['Web content extracted successfully'],
            targetAudience: 'Website visitors',
            valueProposition: 'Content from web source',
            fileSize: undefined,
            pagesCount: undefined,
            characterCount: extractedContent.length,
          },
        };
      } catch (error) {
        console.error('❌ URL extraction failed:', error);
        // Fallback to treating URL as text content
        return {
          processedContent: contentInput,
          extractedData: {
            marketingSummary: 'URL extraction failed, using URL as text',
            keyPoints: ['Unable to extract key points from URL'],
            targetAudience: 'Unknown',
            valueProposition: 'Unknown',
            fileSize: undefined,
            pagesCount: undefined,
            characterCount: contentInput.length,
          },
        };
      }
    } else if (inputType === 'pdf') {
      console.log('📄 Extracting content from PDF...');

      try {
        // Use the PDF content extractor tool
        const extractionResult = await pdfContentExtractorTool.execute!(
          {
            pdfUrl: contentInput,
            focusAreas: ['benefits', 'features', 'value-proposition'],
          },
          {
            mastra,
            requestContext: requestContext || new RequestContext(),
          },
        );

        if ('error' in extractionResult) {
          return {
            processedContent: contentInput,
            extractedData: undefined,
          };
        }

        return {
          processedContent: extractionResult.marketingSummary,
          extractedData: {
            marketingSummary: extractionResult.marketingSummary,
            keyPoints: extractionResult.keyPoints,
            targetAudience: extractionResult.targetAudience,
            valueProposition: extractionResult.valueProposition,
            fileSize: extractionResult.fileSize,
            pagesCount: extractionResult.pagesCount,
            characterCount: extractionResult.characterCount,
          },
        };
      } catch (error) {
        console.error('❌ PDF extraction failed:', error);
        // Fallback to treating PDF URL as text content
        return {
          processedContent: contentInput,
          extractedData: {
            marketingSummary: 'PDF extraction failed, using URL as text',
            keyPoints: ['Unable to extract key points'],
            targetAudience: 'Unknown',
            valueProposition: 'Unknown',
            fileSize: 0,
            pagesCount: 0,
            characterCount: contentInput.length,
          },
        };
      }
    } else {
      console.log('📝 Using provided text content...');

      return {
        processedContent: contentInput,
        extractedData: undefined,
      };
    }
  },
});

// Step 2: Generate ad copy
const generateAdCopyStep = createStep({
  id: 'generate-ad-copy',
  description: 'Generate ad copy optimized for the specified platform',
  inputSchema: z.object({
    processedContent: z.string(),
    extractedData: z.any().optional(),
    platform: z.string(),
    campaignType: z.string(),
    targetAudience: z.string().optional(),
    tone: z.string(),
    productType: z.string().optional(),
  }),
  outputSchema: z.object({
    headline: z.string(),
    body: z.string(),
    cta: z.string(),
  }),
  execute: async ({ inputData, requestContext, mastra }) => {
    const { processedContent, extractedData, platform, campaignType, targetAudience, tone, productType } = inputData;

    console.log('✍️ Generating ad copy...');

    const keyBenefits = extractedData?.keyPoints || [];
    const finalTargetAudience = targetAudience || extractedData?.targetAudience || 'General audience';

    try {
      const adCopyResults = await adCopyGeneratorTool.execute!(
        {
          content: processedContent,
          platform: platform as 'facebook' | 'google' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok' | 'generic',
          campaignType: campaignType as 'awareness' | 'consideration' | 'conversion' | 'retention',
          targetAudience: finalTargetAudience,
          tone: tone as 'professional' | 'casual' | 'playful' | 'urgent' | 'inspirational' | 'authoritative',
          productType,
          keyBenefits,
        },
        {
          mastra,
          requestContext: requestContext || new RequestContext(),
        },
      );

      if ('error' in adCopyResults) {
        return {
          headline: `Amazing ${productType || 'Product'} for ${finalTargetAudience}`,
          body: `Discover how ${processedContent.substring(0, 50)}... can change everything.`,
          cta: 'Get Started Now',
        };
      }

      // Return just the first ad set for simplicity
      const firstAdSet = adCopyResults.adSets[0];

      if (!firstAdSet) {
        return {
          headline: `Amazing ${productType || 'Product'} for ${finalTargetAudience}`,
          body: `Discover how ${processedContent.substring(0, 50)}... can change everything.`,
          cta: 'Get Started Now',
        };
      }

      return {
        headline: firstAdSet.headline,
        body: firstAdSet.body,
        cta: firstAdSet.cta,
      };
    } catch (error) {
      console.error('❌ Ad copy generation failed:', error);

      return {
        headline: `Amazing ${productType || 'Product'} for ${finalTargetAudience}`,
        body: `Discover how ${processedContent.substring(0, 50)}... can change everything.`,
        cta: 'Get Started Now',
      };
    }
  },
});

// Step 3: Generate promotional image
const generateImageStep = createStep({
  id: 'generate-image',
  description: 'Generate a promotional image that complements the ad copy',
  inputSchema: z.object({
    generateImages: z.boolean(),
    imageStyle: z.enum(['photographic', 'digital_art', 'illustration', 'minimalist', 'vintage', 'modern']).optional(),
    platform: z.enum(['facebook', 'google', 'instagram', 'linkedin', 'twitter', 'tiktok', 'generic']).optional(),
    headline: z.string(),
    body: z.string(),
  }),
  outputSchema: z.object({
    imageUrl: z.string().optional(),
  }),
  execute: async ({ inputData, requestContext, mastra }) => {
    const { generateImages, imageStyle = 'modern', platform, headline, body } = inputData;

    if (!generateImages) {
      console.log('⏭️ Skipping image generation as requested...');
      return { imageUrl: undefined };
    }

    console.log('🎨 Generating promotional image...');

    try {
      const imagePrompt = `Professional promotional image for advertisement: ${headline}. ${body.substring(0, 100)}...`;

      const imageResult = await imageGeneratorTool.execute!(
        {
          prompt: imagePrompt,
          style: imageStyle as 'photographic' | 'digital_art' | 'illustration' | 'minimalist' | 'vintage' | 'modern',
          platform:
            platform === 'google' || platform === 'tiktok'
              ? 'generic'
              : (platform as 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'generic') || 'generic',
          size: platform === 'instagram' ? '1024x1024' : '1792x1024',
        },
        {
          mastra,
          requestContext: requestContext || new RequestContext(),
        },
      );

      if ('error' in imageResult) {
        return { imageUrl: undefined };
      }

      console.log('✅ Generated promotional image');
      return { imageUrl: imageResult.imageUrl };
    } catch (error) {
      console.error('❌ Failed to generate image:', error);
      return { imageUrl: undefined };
    }
  },
});

// Main workflow definition
export const adCopyGenerationWorkflow = createWorkflow({
  id: 'ad-copy-generation-workflow',
  inputSchema,
  outputSchema,
})
  // @ts-expect-error - TODO: remove once z.enum().optional().default() type error is fixed
  .then(extractContentStep)
  .map({
    processedContent: {
      step: extractContentStep,
      path: 'processedContent',
      schema: z.string(),
    },
    extractedData: {
      step: extractContentStep,
      path: 'extractedData',
      schema: z.any().optional(),
    },
    platform: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.platform;
      },
    },
    campaignType: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.campaignType;
      },
    },
    targetAudience: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.targetAudience;
      },
    },
    tone: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.tone;
      },
    },
    productType: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.productType;
      },
    },
  })
  .then(generateAdCopyStep)
  .map({
    generateImages: {
      schema: z.boolean(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.generateImages;
      },
    },
    imageStyle: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.imageStyle;
      },
    },
    platform: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData<z.infer<typeof inputSchema>>();
        return initData.platform;
      },
    },
    headline: {
      step: generateAdCopyStep,
      path: 'headline',
      schema: z.string(),
    },
    body: {
      step: generateAdCopyStep,
      path: 'body',
      schema: z.string(),
    },
  })
  .then(generateImageStep)
  .map({
    adCopy: mapVariable({
      step: generateAdCopyStep,
      path: '.',
    }),
    // @ts-expect-error - TODO: remove once mapVariable type error is fixed
    imageUrl: mapVariable({
      step: generateImageStep,
      path: 'imageUrl',
    }),
  })
  .commit();
