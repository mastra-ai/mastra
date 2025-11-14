import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const adCopyGeneratorTool = createTool({
  id: 'ad-copy-generator',
  description: 'Generates compelling ad copy variations from content including headlines, body copy, and CTAs',
  inputSchema: z.object({
    content: z.string().describe('The content to create ad copy from'),
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
      .describe('Tone of voice for the ad copy'),
    productType: z.string().optional().describe('Type of product or service being advertised'),
    keyBenefits: z.array(z.string()).optional().describe('Key benefits to highlight'),
  }),
  outputSchema: z.object({
    headlines: z
      .array(
        z.object({
          text: z.string(),
          variation: z.string(),
          length: z.number(),
        }),
      )
      .describe('Generated headline variations'),
    bodyCopy: z
      .array(
        z.object({
          text: z.string(),
          variation: z.string(),
          length: z.number(),
        }),
      )
      .describe('Generated body copy variations'),
    ctas: z
      .array(
        z.object({
          text: z.string(),
          variation: z.string(),
        }),
      )
      .describe('Generated call-to-action variations'),
    adSets: z
      .array(
        z.object({
          name: z.string(),
          headline: z.string(),
          body: z.string(),
          cta: z.string(),
          description: z.string(),
        }),
      )
      .describe('Complete ad set combinations'),
    platformRecommendations: z
      .object({
        characterLimits: z.record(z.number()).optional(),
        bestPractices: z.array(z.string()),
        optimizationTips: z.array(z.string()),
      })
      .describe('Platform-specific recommendations'),
  }),
  execute: async (inputData, context) => {
    const { content, platform, campaignType, targetAudience, tone, productType, keyBenefits = [] } = inputData;

    console.log(`🎯 Generating ad copy for ${platform} platform with ${tone} tone`);

    try {
      const copywritingAgent = context?.mastra?.getAgent('copywritingAgent');
      if (!copywritingAgent) {
        throw new Error('Copywriting agent not found');
      }

      const keyBenefitsText = keyBenefits.length > 0 ? `Key benefits to highlight: ${keyBenefits.join(', ')}` : '';
      const targetAudienceText = targetAudience ? `Target audience: ${targetAudience}` : '';
      const productTypeText = productType ? `Product/Service type: ${productType}` : '';

      const adCopyPrompt = `You are an expert advertising copywriter. Create compelling ad copy from the following content:

CONTENT TO WORK WITH:
${content}

CAMPAIGN PARAMETERS:
- Platform: ${platform}
- Campaign Type: ${campaignType}
- Tone: ${tone}
${targetAudienceText}
${productTypeText}
${keyBenefitsText}

Generate the following ad copy variations:

1. HEADLINES (5 variations):
   - Short punchy headlines (25-40 characters)
   - Medium headlines (40-60 characters)
   - Long descriptive headlines (60-90 characters)

2. BODY COPY (4 variations):
   - Short format (50-100 words)
   - Medium format (100-150 words)
   - Long format (150-250 words)
   - Bullet point format

3. CALL-TO-ACTIONS (6 variations):
   - Action-oriented CTAs
   - Benefit-focused CTAs
   - Urgency-driven CTAs

4. COMPLETE AD SETS (3 combinations):
   - Combine best headlines, body copy, and CTAs into complete ads

5. PLATFORM RECOMMENDATIONS:
   - Character limits for ${platform}
   - Best practices specific to ${platform}
   - Optimization tips

Format your response as JSON with the exact structure requested in the output schema.`;

      const copyResult = await copywritingAgent.generate([
        {
          role: 'user',
          content: adCopyPrompt,
        },
      ]);

      let parsedCopy;
      try {
        parsedCopy = JSON.parse(copyResult.text || '{}');
      } catch (parseError) {
        console.error('Failed to parse ad copy JSON, creating fallback response');
        // Create a fallback response
        parsedCopy = {
          headlines: [
            { text: 'Transform Your Business Today', variation: 'transformation', length: 28 },
            { text: "Discover What You've Been Missing", variation: 'discovery', length: 34 },
            { text: "The Solution You've Been Looking For", variation: 'solution', length: 37 },
          ],
          bodyCopy: [
            {
              text: 'Ready to take your business to the next level? Our proven solution delivers results that matter.',
              variation: 'short',
              length: 95,
            },
          ],
          ctas: [
            { text: 'Get Started Now', variation: 'action' },
            { text: 'Learn More', variation: 'info' },
            { text: 'Try It Free', variation: 'trial' },
          ],
          adSets: [],
          platformRecommendations: {
            bestPractices: ['Use engaging visuals', 'Test multiple variations'],
            optimizationTips: ['A/B test headlines', 'Monitor performance metrics'],
          },
        };
      }

      console.log(
        `✅ Generated ${parsedCopy.headlines?.length || 0} headlines and ${parsedCopy.bodyCopy?.length || 0} body copy variations`,
      );

      return {
        headlines: parsedCopy.headlines || [],
        bodyCopy: parsedCopy.bodyCopy || [],
        ctas: parsedCopy.ctas || [],
        adSets: parsedCopy.adSets || [],
        platformRecommendations: parsedCopy.platformRecommendations || {
          bestPractices: [],
          optimizationTips: [],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Ad copy generation failed:', errorMessage);
      throw new Error(`Failed to generate ad copy: ${errorMessage}`);
    }
  },
});
