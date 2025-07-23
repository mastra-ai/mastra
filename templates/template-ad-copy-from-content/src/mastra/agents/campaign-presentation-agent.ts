import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

export const campaignPresentationAgent = new Agent({
  name: 'Campaign Presentation Agent',
  instructions: `
    You are a marketing campaign presentation specialist. When given ad copy results and images, 
    you present them in a professional and engaging way.
    
    Your role is to:
    - Present the generated ad copy variations in an organized format
    - Display the generated images alongside the ad copy
    - Provide insights on how to use the generated assets
    - Suggest next steps for the campaign
    
    When you receive images, you should view them and comment on how well they complement the ad copy.
    Be specific about what you see in the images and how they could be used in the campaign.
  `,
  model: openai('gpt-4o'),
});

// Helper function to create presentation content with images
export const presentCampaignResults = async (campaignResults: {
  adCopy: any;
  images?: Array<{
    imageUrl: string;
    revisedPrompt: string;
    dimensions: { width: number; height: number };
    generatedAt: string;
  }>;
  campaignSummary: any;
}) => {
  const { adCopy, images, campaignSummary } = campaignResults;

  // Prepare content array for the agent
  const content: any[] = [
    {
      type: 'text',
      text: `Please present this marketing campaign with the following results:

## Campaign Overview
- Platform: ${campaignSummary.platform}
- Campaign Type: ${campaignSummary.campaignType}
- Target Audience: ${campaignSummary.targetAudience}
- Total Variations: ${campaignSummary.totalVariations}

## Generated Ad Copy
**Headlines (${adCopy.headlines.length} variations):**
${adCopy.headlines.map((h: any, i: number) => `${i + 1}. "${h.text}" (${h.variation} style, ${h.length} chars)`).join('\n')}

**Body Copy (${adCopy.bodyCopy.length} variations):**
${adCopy.bodyCopy.map((b: any, i: number) => `${i + 1}. "${b.text}" (${b.variation} style, ${b.length} chars)`).join('\n')}

**Call-to-Actions (${adCopy.ctas.length} variations):**
${adCopy.ctas.map((c: any, i: number) => `${i + 1}. "${c.text}" (${c.variation} style)`).join('\n')}

## Platform Recommendations
**Best Practices:**
${adCopy.platformRecommendations.bestPractices.map((bp: string) => `• ${bp}`).join('\n')}

**Optimization Tips:**
${adCopy.platformRecommendations.optimizationTips.map((tip: string) => `• ${tip}`).join('\n')}

## Next Steps
${campaignSummary.recommendedNext.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}

${images && images.length > 0 ? `\n## Generated Images\nI'll now view the ${images.length} generated promotional images and provide feedback on how they complement the ad copy.` : ''}
      `,
    }
  ];

  // Add images to the content if they exist
  if (images && images.length > 0) {
    images.forEach((image, i) => {
      content.push({
        type: 'image',
        image: new URL(image.imageUrl),
      });
      content.push({
        type: 'text',
        text: `Image ${i + 1}: Generated at ${new Date(image.generatedAt).toLocaleString()} (${image.dimensions.width}x${image.dimensions.height}px)\nPrompt used: "${image.revisedPrompt}"\n`,
      });
    });
  }

  // Generate the presentation
  const response = await campaignPresentationAgent.generate([
    {
      role: 'user',
      content: content,
    },
  ]);

  return response.text;
};