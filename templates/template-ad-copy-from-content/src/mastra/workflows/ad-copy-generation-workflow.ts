import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/di';
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
  brandColors: z.array(z.string()).optional().describe('Brand colors to use (hex codes)'),
});

const outputSchema = z.object({
  extractedContent: z
    .object({
      marketingSummary: z.string(),
      keyPoints: z.array(z.string()),
      targetAudience: z.string().optional(),
      valueProposition: z.string().optional(),
      fileSize: z.number().optional(),
      pagesCount: z.number().optional(),
      characterCount: z.number().optional(),
    })
    .optional()
    .describe('Content extracted from PDF (if applicable)'),
  adCopy: z
    .object({
      headlines: z.array(
        z.object({
          text: z.string(),
          variation: z.string(),
          length: z.number(),
        }),
      ),
      bodyCopy: z.array(
        z.object({
          text: z.string(),
          variation: z.string(),
          length: z.number(),
        }),
      ),
      ctas: z.array(
        z.object({
          text: z.string(),
          variation: z.string(),
        }),
      ),
      adSets: z.array(
        z.object({
          name: z.string(),
          headline: z.string(),
          body: z.string(),
          cta: z.string(),
          description: z.string(),
        }),
      ),
      platformRecommendations: z.object({
        characterLimits: z.record(z.number()).optional(),
        bestPractices: z.array(z.string()),
        optimizationTips: z.array(z.string()),
      }),
    })
    .describe('Generated ad copy variations'),
  images: z
    .array(
      z.object({
        imageUrl: z.string(),
        revisedPrompt: z.string(),
        dimensions: z.object({
          width: z.number(),
          height: z.number(),
        }),
        generatedAt: z.string(),
      }),
    )
    .optional()
    .describe('Generated promotional images with direct DALL-E URLs'),
  campaignSummary: z
    .object({
      platform: z.string(),
      campaignType: z.string(),
      targetAudience: z.string(),
      totalVariations: z.number(),
      recommendedNext: z.array(z.string()),
    })
    .describe('Campaign summary and recommendations'),
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
  execute: async ({ inputData, runtimeContext, mastra }) => {
    const { contentInput, inputType } = inputData;

    console.log(`📝 Processing ${inputType} content...`);

    if (inputType === 'url') {
      console.log('🌐 Extracting content from website URL...');

      try {
        // Import mastra instance directly since runtime context access is complex in workflows
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
        const extractionResult = await pdfContentExtractorTool.execute({
          context: {
            pdfUrl: contentInput,
            focusAreas: ['benefits', 'features', 'value-proposition'],
          },
          runtimeContext: runtimeContext || new RuntimeContext(),
        });

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

// Step 2: Generate ad copy variations
const generateAdCopyStep = createStep({
  id: 'generate-ad-copy',
  description: 'Generate multiple ad copy variations optimized for the specified platform',
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
    headlines: z.array(
      z.object({
        text: z.string(),
        variation: z.string(),
        length: z.number(),
      }),
    ),
    bodyCopy: z.array(
      z.object({
        text: z.string(),
        variation: z.string(),
        length: z.number(),
      }),
    ),
    ctas: z.array(
      z.object({
        text: z.string(),
        variation: z.string(),
      }),
    ),
    adSets: z.array(
      z.object({
        name: z.string(),
        headline: z.string(),
        body: z.string(),
        cta: z.string(),
        description: z.string(),
      }),
    ),
    platformRecommendations: z.object({
      characterLimits: z.record(z.number()).optional(),
      bestPractices: z.array(z.string()),
      optimizationTips: z.array(z.string()),
    }),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { processedContent, extractedData, platform, campaignType, targetAudience, tone, productType } = inputData;

    console.log('✍️ Generating ad copy variations...');

    // Determine key benefits and target audience
    const keyBenefits = extractedData?.keyPoints || [];
    const finalTargetAudience = targetAudience || extractedData?.targetAudience || 'General audience';

    try {
      // Use the ad copy generator tool
      const adCopyResults = await adCopyGeneratorTool.execute({
        context: {
          content: processedContent,
          platform: platform as 'facebook' | 'google' | 'instagram' | 'linkedin' | 'twitter' | 'tiktok' | 'generic',
          campaignType: campaignType as 'awareness' | 'consideration' | 'conversion' | 'retention',
          targetAudience: finalTargetAudience,
          tone: tone as 'professional' | 'casual' | 'playful' | 'urgent' | 'inspirational' | 'authoritative',
          productType,
          keyBenefits,
        },
        runtimeContext: runtimeContext || new RuntimeContext(),
      });

      return adCopyResults;
    } catch (error) {
      console.error('❌ Ad copy generation failed:', error);

      // Fallback to mock data if tool fails
      return {
        headlines: [
          {
            text: `Amazing ${productType || 'Product'} for ${finalTargetAudience}`,
            variation: 'benefit-focused',
            length: 50,
          },
          {
            text: `Transform Your Life with ${productType || 'Our Solution'}`,
            variation: 'transformation',
            length: 45,
          },
          { text: `Get Results with ${productType || 'Premium Solution'}`, variation: 'result-oriented', length: 40 },
        ],
        bodyCopy: [
          {
            text: `Discover how ${processedContent.substring(0, 50)}... can change everything for you.`,
            variation: 'storytelling',
            length: 80,
          },
          {
            text: `Join thousands who chose ${productType || 'our solution'} for ${campaignType} results.`,
            variation: 'social-proof',
            length: 75,
          },
        ],
        ctas: [
          { text: 'Get Started Now', variation: 'direct' },
          { text: 'Learn More', variation: 'soft' },
          { text: 'Try Free Today', variation: 'trial' },
        ],
        adSets: [
          {
            name: 'Primary Campaign',
            headline: `Amazing ${productType || 'Product'} for ${finalTargetAudience}`,
            body: `Discover how ${processedContent.substring(0, 30)}... can change everything.`,
            cta: 'Get Started Now',
            description: 'Main campaign targeting core audience',
          },
          {
            name: 'Secondary Campaign',
            headline: `Transform Your Life with ${productType || 'Our Solution'}`,
            body: `Join thousands who chose ${productType || 'our solution'} for results.`,
            cta: 'Learn More',
            description: 'Alternative approach for broader reach',
          },
        ],
        platformRecommendations: {
          characterLimits: { headline: 30, body: 90 },
          bestPractices: [`Optimize for ${platform} audience`, 'Use clear value proposition', 'Include strong CTA'],
          optimizationTips: ['A/B test headlines', 'Monitor engagement rates', 'Adjust based on performance'],
        },
      };
    }
  },
});

// Step 3: Generate promotional images (conditional)
const generateImagesStep = createStep({
  id: 'generate-images',
  description: 'Generate promotional images that complement the ad copy',
  inputSchema: z.object({
    generateImages: z.boolean(),
    imageStyle: z.enum(['photographic', 'digital_art', 'illustration', 'minimalist', 'vintage', 'modern']).optional(),
    platform: z.enum(['facebook', 'google', 'instagram', 'linkedin', 'twitter', 'tiktok', 'generic']).optional(),
    brandColors: z.array(z.string()).optional(),
    adSets: z.array(
      z.object({
        name: z.string(),
        headline: z.string(),
        body: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    images: z
      .array(
        z.object({
          imageUrl: z.string(),
          revisedPrompt: z.string(),
          dimensions: z.object({
            width: z.number(),
            height: z.number(),
          }),
          generatedAt: z.string(),
        }),
      )
      .optional(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { generateImages, imageStyle = 'modern', platform, adSets } = inputData;

    if (!generateImages) {
      console.log('⏭️ Skipping image generation as requested...');
      return { images: undefined };
    }

    console.log('🎨 Generating promotional images...');

    // Generate images for the top 2 ad sets
    const topAdSets = adSets.slice(0, 2);
    const generatedImages = [];

    for (let i = 0; i < topAdSets.length; i++) {
      const adSet = topAdSets[i];

      try {
        const imagePrompt = `Professional promotional image for advertisement: ${adSet.headline}. ${adSet.body.substring(0, 100)}...`;

        // Use the image generator tool
        const imageResult = await imageGeneratorTool.execute({
          context: {
            prompt: imagePrompt,
            style: imageStyle as 'photographic' | 'digital_art' | 'illustration' | 'minimalist' | 'vintage' | 'modern',
            platform:
              platform === 'google' || platform === 'tiktok'
                ? 'generic'
                : (platform as 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'generic') || 'generic',
            size: platform === 'instagram' ? '1024x1024' : '1792x1024',
          },
          runtimeContext: runtimeContext || new RuntimeContext(),
        });

        generatedImages.push(imageResult);
        console.log(`✅ Generated image ${i + 1} for ad set: ${adSet.name}`);
      } catch (error) {
        console.error(`❌ Failed to generate image ${i + 1}:`, error);
        // Skip failed images rather than using placeholders
        console.log(`⚠️ Skipping image ${i + 1} for ad set: ${adSet.name} due to generation failure`);
      }
    }

    return {
      images: generatedImages.length > 0 ? generatedImages : undefined,
    };
  },
});

// Step 4: Create campaign summary and recommendations
const createSummaryStep = createStep({
  id: 'create-summary',
  description: 'Create campaign summary with recommendations for next steps',
  inputSchema: z.object({
    platform: z.string(),
    campaignType: z.string(),
    targetAudience: z.string().optional(),
    extractedTargetAudience: z.string().optional(),
    headlines: z.array(z.any()),
    bodyCopy: z.array(z.any()),
    ctas: z.array(z.any()),
    images: z.array(z.any()).optional(),
  }),
  outputSchema: z.object({
    platform: z.string(),
    campaignType: z.string(),
    targetAudience: z.string(),
    totalVariations: z.number(),
    recommendedNext: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const { platform, campaignType, targetAudience, extractedTargetAudience, headlines, bodyCopy, ctas, images } =
      inputData;

    console.log('📊 Creating campaign summary...');

    const totalHeadlines = headlines?.length || 0;
    const totalBodyCopy = bodyCopy?.length || 0;
    const totalCTAs = ctas?.length || 0;
    const totalImages = images?.length || 0;

    const finalTargetAudience = targetAudience || extractedTargetAudience || 'General audience';

    const recommendedNext = [
      'A/B test the top 3 headline variations',
      `Launch campaigns on ${platform} with generated assets`,
      'Monitor performance metrics and optimize based on results',
      'Create additional variations for underperforming elements',
    ];

    if (totalImages > 0) {
      recommendedNext.push('Test different image styles to optimize visual performance');
    }

    return {
      platform,
      campaignType,
      targetAudience: finalTargetAudience,
      totalVariations: totalHeadlines + totalBodyCopy + totalCTAs + totalImages,
      recommendedNext,
    };
  },
});

// Main workflow definition
export const adCopyGenerationWorkflow = createWorkflow({
  id: 'ad-copy-generation-workflow',
  inputSchema,
  outputSchema,
})
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
        const initData = getInitData();
        return initData.platform;
      },
    },
    campaignType: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.campaignType;
      },
    },
    targetAudience: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.targetAudience;
      },
    },
    tone: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.tone;
      },
    },
    productType: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.productType;
      },
    },
  })
  .then(generateAdCopyStep)
  .map({
    generateImages: {
      schema: z.boolean(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.generateImages;
      },
    },
    imageStyle: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.imageStyle;
      },
    },
    platform: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.platform;
      },
    },
    brandColors: {
      schema: z.array(z.string()).optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.brandColors;
      },
    },
    adSets: {
      step: generateAdCopyStep,
      path: 'adSets',
      schema: z.array(
        z.object({
          name: z.string(),
          headline: z.string(),
          body: z.string(),
        }),
      ),
    },
  })
  .then(generateImagesStep)
  .map({
    platform: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.platform;
      },
    },
    campaignType: {
      schema: z.string(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.campaignType;
      },
    },
    targetAudience: {
      schema: z.string().optional(),
      fn: async ({ getInitData }) => {
        const initData = getInitData();
        return initData.targetAudience;
      },
    },
    extractedTargetAudience: {
      schema: z.string().optional(),
      fn: async ({ getStepResult }) => {
        const contentResult = getStepResult(extractContentStep);
        return contentResult.extractedData?.targetAudience;
      },
    },
    headlines: {
      step: generateAdCopyStep,
      path: 'headlines',
      schema: z.array(z.any()),
    },
    bodyCopy: {
      step: generateAdCopyStep,
      path: 'bodyCopy',
      schema: z.array(z.any()),
    },
    ctas: {
      step: generateAdCopyStep,
      path: 'ctas',
      schema: z.array(z.any()),
    },
    images: {
      step: generateImagesStep,
      path: 'images',
      schema: z.array(z.any()).optional(),
    },
  })
  .then(createSummaryStep)
  .map({
    extractedContent: {
      schema: z
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
      fn: async ({ getStepResult }) => {
        const contentResult = getStepResult(extractContentStep);
        return contentResult.extractedData;
      },
    },
    adCopy: {
      step: generateAdCopyStep,
      path: '',
      schema: z.object({
        headlines: z.array(
          z.object({
            text: z.string(),
            variation: z.string(),
            length: z.number(),
          }),
        ),
        bodyCopy: z.array(
          z.object({
            text: z.string(),
            variation: z.string(),
            length: z.number(),
          }),
        ),
        ctas: z.array(
          z.object({
            text: z.string(),
            variation: z.string(),
          }),
        ),
        adSets: z.array(
          z.object({
            name: z.string(),
            headline: z.string(),
            body: z.string(),
            cta: z.string(),
            description: z.string(),
          }),
        ),
        platformRecommendations: z.object({
          characterLimits: z.record(z.number()).optional(),
          bestPractices: z.array(z.string()),
          optimizationTips: z.array(z.string()),
        }),
      }),
    },
    images: {
      step: generateImagesStep,
      path: 'images',
      schema: z
        .array(
          z.object({
            imageUrl: z.string(),
            revisedPrompt: z.string(),
            dimensions: z.object({
              width: z.number(),
              height: z.number(),
            }),
            generatedAt: z.string(),
          }),
        )
        .optional(),
    },
    campaignSummary: {
      step: createSummaryStep,
      path: '',
      schema: z.object({
        platform: z.string(),
        campaignType: z.string(),
        targetAudience: z.string(),
        totalVariations: z.number(),
        recommendedNext: z.array(z.string()),
      }),
    },
  })
  .commit();
