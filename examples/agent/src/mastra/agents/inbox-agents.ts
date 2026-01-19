import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Tool for categorizing support requests
 */
const categorizeTool = tool({
  description: 'Categorizes a support request into a category',
  parameters: z.object({
    request: z.string().describe('The support request to categorize'),
  }),
  execute: async ({ request }) => {
    // Simple keyword-based categorization
    const lowerRequest = request.toLowerCase();
    if (lowerRequest.includes('billing') || lowerRequest.includes('payment') || lowerRequest.includes('charge')) {
      return { category: 'billing', confidence: 0.9 };
    }
    if (lowerRequest.includes('bug') || lowerRequest.includes('error') || lowerRequest.includes('broken')) {
      return { category: 'technical', confidence: 0.85 };
    }
    if (lowerRequest.includes('feature') || lowerRequest.includes('request') || lowerRequest.includes('suggestion')) {
      return { category: 'feature-request', confidence: 0.8 };
    }
    return { category: 'general', confidence: 0.7 };
  },
});

/**
 * Tool for generating support responses
 */
const generateResponseTool = tool({
  description: 'Generates a support response based on the category and request',
  parameters: z.object({
    category: z.string().describe('The category of the support request'),
    request: z.string().describe('The original support request'),
  }),
  execute: async ({ category, request }) => {
    const responses: Record<string, string> = {
      billing: `Thank you for reaching out about your billing concern. I've reviewed your request: "${request.substring(0, 50)}...". Our billing team will investigate this and get back to you within 24 hours.`,
      technical: `I understand you're experiencing a technical issue. I've logged this issue for our engineering team to investigate. In the meantime, please try clearing your cache and refreshing the page.`,
      'feature-request': `Thank you for your feature suggestion! We value customer feedback and have added this to our product roadmap for consideration.`,
      general: `Thank you for contacting support. I've reviewed your request and will ensure it gets to the right team.`,
    };
    return { response: responses[category] || responses.general };
  },
});

/**
 * Support agent that processes support inbox tasks.
 * This agent is designed to handle customer support requests.
 */
export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  description: 'Processes customer support requests from the inbox',
  instructions: `
    You are a helpful customer support agent. When processing a support task:
    1. First use the categorize tool to understand the type of request
    2. Then use the generate-response tool to create an appropriate response
    3. Return a helpful, professional response to the customer

    Always be polite, empathetic, and solution-oriented.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    categorize: categorizeTool,
    generateResponse: generateResponseTool,
  },
});

/**
 * Tool for analyzing text content
 */
const analyzeTextTool = tool({
  description: 'Analyzes text content and extracts key information',
  parameters: z.object({
    text: z.string().describe('The text to analyze'),
    analysisType: z.enum(['sentiment', 'summary', 'keywords']).describe('Type of analysis to perform'),
  }),
  execute: async ({ text, analysisType }) => {
    // Simulated analysis results
    switch (analysisType) {
      case 'sentiment':
        return {
          sentiment: text.length > 100 ? 'neutral' : 'positive',
          score: 0.75,
          confidence: 0.85,
        };
      case 'summary':
        return {
          summary: text.substring(0, 100) + '...',
          wordCount: text.split(' ').length,
        };
      case 'keywords':
        const words = text.toLowerCase().split(/\s+/);
        const wordFreq: Record<string, number> = {};
        words.forEach(w => {
          if (w.length > 4) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
        return {
          keywords: Object.entries(wordFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word),
        };
      default:
        return { error: 'Unknown analysis type' };
    }
  },
});

/**
 * Analysis agent that processes analysis inbox tasks.
 * This agent handles document and data analysis requests.
 */
export const analysisAgent = new Agent({
  id: 'analysis-agent',
  name: 'Analysis Agent',
  description: 'Processes analysis tasks from the inbox',
  instructions: `
    You are an expert data analyst. When processing an analysis task:
    1. Examine the payload to understand what needs to be analyzed
    2. Use the analyze-text tool with the appropriate analysis type
    3. Provide a clear, concise analysis result

    Be thorough and objective in your analysis.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    analyzeText: analyzeTextTool,
  },
});
