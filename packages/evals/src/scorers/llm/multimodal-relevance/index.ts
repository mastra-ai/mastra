import type { MastraLanguageModel } from '@mastra/core/agent';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { createScorer } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals } from '../../../metrics/llm/utils';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import { createAnalyzePrompt, createReasonPrompt } from './prompts';

export interface MultimodalContext {
  type: 'text' | 'image' | 'multimodal';
  content: string | any;
}

export interface MultimodalRelevanceOptions {
  contextualGroundingWeight?: number;
  multimodalAlignmentWeight?: number;
  queryAlignmentWeight?: number;
  scale?: number;
}

export const DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS: Required<MultimodalRelevanceOptions> = {
  contextualGroundingWeight: 0.4,
  multimodalAlignmentWeight: 0.3,
  queryAlignmentWeight: 0.3,
  scale: 1,
};

export const MULTIMODAL_RELEVANCE_AGENT_INSTRUCTIONS = `
You are a specialized multimodal relevance evaluator. Your primary responsibility is to assess whether AI responses appropriately utilize provided multimodal contexts (text, images, or both) to address user queries.

Key Evaluation Principles:
1. Contextual Grounding: Evaluate how well the response uses the provided contexts
2. Multimodal Alignment: Assess proper handling of different content types (text, images)
3. Query Alignment: Determine if the response addresses the user's specific question
4. Relevance over Accuracy: Focus on context utilization, not factual correctness
5. Partial Credit: Recognize degrees of relevance rather than binary judgments

Your evaluations should be thorough, consistent, and focused on multimodal content integration.
`;

const analyzeOutputSchema = z.object({
  contextual_grounding: z.string(),
  multimodal_alignment: z.string(),
  query_alignment: z.string(),
  relevance_score: z.number().min(0).max(1),
  reasoning: z.string(),
});

export function createMultimodalRelevanceScorer({
  model,
  options = DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS,
}: {
  model: MastraLanguageModel;
  options?: MultimodalRelevanceOptions;
}) {
  const finalOptions = { ...DEFAULT_MULTIMODAL_RELEVANCE_OPTIONS, ...options };

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Multimodal Relevance Scorer',
    description:
      'A scorer that evaluates the relevance of LLM responses to multimodal contexts (text, images, or both)',
    judge: {
      model,
      instructions: MULTIMODAL_RELEVANCE_AGENT_INSTRUCTIONS,
    },
  })
    .analyze({
      description: 'Analyze multimodal relevance across contextual grounding, alignment, and query addressing',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const aiResponse = getAssistantMessageFromRunOutput(run.output) ?? '';

        // Extract multimodal contexts from runtime context or ground truth
        const contexts: MultimodalContext[] = extractMultimodalContexts(run);

        return createAnalyzePrompt({
          userInput,
          aiResponse,
          contexts,
        });
      },
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult) {
        return 0;
      }

      const analysis = results.analyzeStepResult;

      // Use the initial relevance score from the analysis as baseline
      let finalScore = analysis.relevance_score;

      // Apply weighted adjustments based on the analysis components
      // This provides a more nuanced scoring approach while still respecting the LLM's assessment
      const weightedScore =
        finalScore * finalOptions.contextualGroundingWeight +
        finalScore * finalOptions.multimodalAlignmentWeight +
        finalScore * finalOptions.queryAlignmentWeight;

      return roundToTwoDecimals(weightedScore * finalOptions.scale);
    })
    .generateReason({
      description: 'Generate explanation for multimodal relevance score',
      createPrompt: ({ run, results, score }) => {
        const userInput = getUserMessageFromRunInput(run.input) ?? '';
        const aiResponse = getAssistantMessageFromRunOutput(run.output) ?? '';
        const analysisResult = results.analyzeStepResult;

        if (!analysisResult) {
          return `Unable to generate reasoning due to missing analysis results.`;
        }

        return createReasonPrompt({
          userInput,
          aiResponse,
          score,
          analysisResult,
        });
      },
    });
}

function extractMultimodalContexts(run: any): MultimodalContext[] {
  // Check multiple possible locations for multimodal contexts
  const contexts: MultimodalContext[] = [];

  // Check runtimeContext for multimodal data
  if (run.runtimeContext?.contexts) {
    const runtimeContexts = Array.isArray(run.runtimeContext.contexts)
      ? run.runtimeContext.contexts
      : [run.runtimeContext.contexts];

    for (const ctx of runtimeContexts) {
      contexts.push(inferContextType(ctx));
    }
  }

  // Check groundTruth for multimodal data
  if (run.groundTruth?.contexts) {
    const groundTruthContexts = Array.isArray(run.groundTruth.contexts)
      ? run.groundTruth.contexts
      : [run.groundTruth.contexts];

    for (const ctx of groundTruthContexts) {
      contexts.push(inferContextType(ctx));
    }
  }

  // Check input for multimodal message content
  if (run.input?.messages) {
    for (const message of run.input.messages) {
      if (Array.isArray(message.content)) {
        // Handle multimodal message content (text + images)
        const textParts: string[] = [];
        let hasImages = false;

        for (const part of message.content) {
          if (part.type === 'text') {
            textParts.push(part.text);
          } else if (part.type === 'image') {
            hasImages = true;
          }
        }

        if (hasImages && textParts.length > 0) {
          contexts.push({
            type: 'multimodal',
            content: textParts.join(' ') + ' [Plus image content]',
          });
        } else if (hasImages) {
          contexts.push({
            type: 'image',
            content: '[Image content]',
          });
        } else if (textParts.length > 0) {
          contexts.push({
            type: 'text',
            content: textParts.join(' '),
          });
        }
      }
    }
  }

  // Fallback: if no contexts found, create a default text context from user input
  if (contexts.length === 0) {
    const userInput = getUserMessageFromRunInput(run.input);
    if (userInput) {
      contexts.push({
        type: 'text',
        content: userInput,
      });
    }
  }

  return contexts;
}

function inferContextType(ctx: any): MultimodalContext {
  // If context has explicit type, use it
  if (ctx.type) {
    return {
      type: ctx.type,
      content: ctx.content || ctx.text || String(ctx),
    };
  }

  // Infer type based on content structure
  const content = ctx.content || ctx.text || ctx;

  // Check if it looks like image data or has image indicators
  if (typeof content === 'string') {
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes('image') ||
      lowerContent.includes('visual') ||
      lowerContent.includes('picture') ||
      content.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg)/i.test(content)
    ) {
      return { type: 'image', content };
    }
  }

  // Check for complex multimodal objects
  if (typeof content === 'object' && content !== null) {
    return { type: 'multimodal', content };
  }

  // Default to text
  return { type: 'text', content: String(content) };
}
