import { createScorer } from '@mastra/core/evals';
import type { MastraModelConfig } from '@mastra/core/llm';

/**
 * RetrievalHopQualityScorer
 *
 * Evaluates the quality of each retrieval hop in a multi-step RAG agent workflow.
 * Scores two orthogonal dimensions per hop:
 *   1. retrieval_confidence  — did the retrieved chunk actually support the hop query?
 *   2. reasoning_fidelity    — did the agent's reasoning faithfully use the retrieved content?
 *
 * Addresses the gap described in mastra-ai/mastra#18086:
 * Mastra's existing tracing shows WHAT happened; this scorer shows HOW WELL each step performed.
 *
 * @example
 * import { RetrievalHopQualityScorer } from '@mastra/evals/scorers/llm/retrieval-hop-quality';
 *
 * const scorer = RetrievalHopQualityScorer({ model: { provider: 'OPEN_AI', name: 'gpt-4o-mini' } });
 *
 * const result = await scorer.score({
 *   input: 'What was the revenue growth rate in Q3?',
 *   output: 'Revenue grew 12% year-over-year based on the earnings call.',
 *   context: ['Q3 earnings call: Total revenue increased 12% YoY to $4.2B.'],
 * });
 * // result.score: 0.0 - 1.0 (average across both dimensions)
 * // result.info.retrieval_confidence: 0.0 - 1.0
 * // result.info.reasoning_fidelity: 0.0 - 1.0
 * // result.info.hop_failure_reason: string | null
 */

export interface RetrievalHopQualityOptions {
  /** LLM model to use as judge */
  model: MastraModelConfig;
  /**
   * Minimum retrieval_confidence score to consider the hop passing.
   * Below this threshold, reasoning_fidelity is not penalized for context gaps.
   * @default 0.5
   */
  retrievalThreshold?: number;
}

export interface RetrievalHopQualityInfo {
  /** 0-1: How well the retrieved context supported the hop query */
  retrieval_confidence: number;
  /** 0-1: How faithfully the agent used the retrieved context in its reasoning */
  reasoning_fidelity: number;
  /** Human-readable reason for a low score, or null if passing */
  hop_failure_reason: string | null;
  /** Raw LLM judge reasoning */
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an evaluation judge for multi-step RAG agent workflows.
You assess retrieval hop quality across two dimensions.

For each hop, score:
1. retrieval_confidence (0.0-1.0): Does the retrieved context directly address the hop query?
   - 1.0: Context contains precise, directly relevant information
   - 0.7: Context is related but requires inference
   - 0.4: Context is tangentially relevant
   - 0.0: Context does not address the query at all

2. reasoning_fidelity (0.0-1.0): Does the agent output faithfully use the retrieved context?
   - 1.0: Output is grounded in and consistent with retrieved context
   - 0.7: Output mostly follows context with minor extrapolation
   - 0.4: Output partially uses context but adds unsupported claims
   - 0.0: Output contradicts or ignores the retrieved context

Respond in JSON:
{
  "retrieval_confidence": <number>,
  "reasoning_fidelity": <number>,
  "hop_failure_reason": <string or null>,
  "reasoning": <string>
}`;

const createUserPrompt = (input: string, output: string, context: string[]) => `
Hop Query: ${input}

Retrieved Context:
${context.map((c, i) => `[${i + 1}] ${c}`).join('\n')}

Agent Output for this hop:
${output}

Evaluate retrieval_confidence and reasoning_fidelity.`;

export const RetrievalHopQualityScorer = (options: RetrievalHopQualityOptions) => {
  const { model, retrievalThreshold = 0.5 } = options;

  return createScorer<RetrievalHopQualityInfo>({
    name: 'RetrievalHopQuality',
    description:
      'Scores multi-step RAG hops on retrieval confidence and reasoning fidelity. ' +
      'Surfaces which hop in a chain degraded retrieval or reasoning quality.',
    model,
    async score({ input, output, context = [] }) {
      const userPrompt = createUserPrompt(
        typeof input === 'string' ? input : JSON.stringify(input),
        typeof output === 'string' ? output : JSON.stringify(output),
        context.map((c) => (typeof c === 'string' ? c : JSON.stringify(c))),
      );

      const response = await this.generateText({
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      let parsed: RetrievalHopQualityInfo;
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch?.[0] ?? '{}');
      } catch {
        parsed = {
          retrieval_confidence: 0,
          reasoning_fidelity: 0,
          hop_failure_reason: 'Failed to parse judge response',
          reasoning: response.text,
        };
      }

      const retrievalConfidence = Math.max(0, Math.min(1, parsed.retrieval_confidence ?? 0));
      const reasoningFidelity = Math.max(0, Math.min(1, parsed.reasoning_fidelity ?? 0));

      // If retrieval itself failed (below threshold), weight retrieval more heavily in final score
      // to surface that the hop failed at retrieval, not reasoning.
      const score =
        retrievalConfidence < retrievalThreshold
          ? retrievalConfidence * 0.7 + reasoningFidelity * 0.3
          : (retrievalConfidence + reasoningFidelity) / 2;

      return {
        score: Math.round(score * 100) / 100,
        info: {
          retrieval_confidence: retrievalConfidence,
          reasoning_fidelity: reasoningFidelity,
          hop_failure_reason: parsed.hop_failure_reason ?? null,
          reasoning: parsed.reasoning ?? '',
        },
      };
    },
  });
};
