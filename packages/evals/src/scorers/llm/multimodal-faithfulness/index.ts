import type { MastraLanguageModel } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/scores';
import type { ScorerRunInputForAgent, ScorerRunOutputForAgent } from '@mastra/core/scores';
import { z } from 'zod';
import { roundToTwoDecimals } from '../../../metrics/llm/utils';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '../../utils';
import {
  MULTIMODAL_FAITHFULNESS_AGENT_INSTRUCTIONS,
  createMultimodalFaithfulnessExtractPrompt,
  createMultimodalFaithfulnessAnalyzePrompt,
  createMultimodalFaithfulnessReasonPrompt,
} from './prompts';

export interface MultimodalContext {
  type: 'text' | 'image' | 'multimodal';
  content: string | any;
}

export interface MultimodalFaithfulnessOptions {
  scale?: number;
  contexts?: MultimodalContext[];
}

export const DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS: Required<MultimodalFaithfulnessOptions> = {
  scale: 1,
  contexts: [],
};

const extractOutputSchema = z.object({
  claims: z.array(z.string()),
});

const analyzeOutputSchema = z.object({
  verdicts: z.array(
    z.object({
      claim: z.string(),
      verdict: z.string(),
      reason: z.string(),
    }),
  ),
});

type _ExtractOutput = z.infer<typeof extractOutputSchema>;
type _AnalyzeOutput = z.infer<typeof analyzeOutputSchema>;

export function createMultimodalFaithfulnessScorer({
  model,
  options = DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS,
}: {
  model: MastraLanguageModel;
  options?: MultimodalFaithfulnessOptions;
}) {
  const finalOptions = { ...DEFAULT_MULTIMODAL_FAITHFULNESS_OPTIONS, ...options };

  return createScorer<ScorerRunInputForAgent, ScorerRunOutputForAgent>({
    name: 'Multimodal Faithfulness Scorer',
    description:
      'A scorer that evaluates the faithfulness of LLM responses to multimodal contexts (text, images, or both)',
    judge: {
      model,
      instructions: MULTIMODAL_FAITHFULNESS_AGENT_INSTRUCTIONS,
    },
  })
    .preprocess({
      description: 'Extract factual claims from the LLM output',
      outputSchema: extractOutputSchema,
      createPrompt: ({ run }) => {
        const output = getAssistantMessageFromRunOutput(run.output) ?? '';
        return createMultimodalFaithfulnessExtractPrompt({ output });
      },
    })
    .analyze({
      description: 'Verify each claim against multimodal contexts for faithfulness',
      outputSchema: analyzeOutputSchema,
      createPrompt: ({ run, results }) => {
        const claims = results.preprocessStepResult?.claims || [];

        // Extract multimodal contexts from multiple sources
        const contexts: MultimodalContext[] = extractMultimodalContexts(run, finalOptions.contexts);

        return createMultimodalFaithfulnessAnalyzePrompt({
          claims,
          contexts,
        });
      },
    })
    .generateScore(({ results }) => {
      if (!results.analyzeStepResult || !results.preprocessStepResult) {
        return 0;
      }

      const { verdicts } = results.analyzeStepResult;
      const { claims } = results.preprocessStepResult;

      if (claims.length === 0) {
        return finalOptions.scale; // No claims means perfect faithfulness
      }

      // Count supported claims for faithfulness score
      const supportedCount = verdicts.filter(v => v.verdict.toLowerCase() === 'yes').length;
      const score = (supportedCount / claims.length) * finalOptions.scale;

      return roundToTwoDecimals(score);
    })
    .generateReason({
      description: 'Generate explanation for multimodal faithfulness score',
      createPrompt: ({ results, score }) => {
        if (!results.analyzeStepResult || !results.preprocessStepResult) {
          return `Unable to generate reasoning due to missing analysis results.`;
        }

        const { verdicts } = results.analyzeStepResult;
        const { claims } = results.preprocessStepResult;

        return createMultimodalFaithfulnessReasonPrompt({
          claims,
          verdicts,
          score,
          scale: finalOptions.scale,
        });
      },
    });
}

function extractMultimodalContexts(run: any, providedContexts: MultimodalContext[]): MultimodalContext[] {
  const contexts: MultimodalContext[] = [...providedContexts];

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
  if (run.input?.inputMessages) {
    for (const message of run.input.inputMessages) {
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

  // Check for tool invocation results as context (common in RAG systems)
  if (run.output) {
    const assistantMessage = run.output.find((msg: any) => msg.role === 'assistant');
    if (assistantMessage?.toolInvocations) {
      for (const toolCall of assistantMessage.toolInvocations) {
        if (toolCall.state === 'result' && toolCall.result) {
          contexts.push(inferContextType(toolCall.result));
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
