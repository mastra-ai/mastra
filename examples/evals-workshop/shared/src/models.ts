/**
 * Model selection for the workshop.
 *
 * Two models, deliberately:
 *
 * - `echoModel()` is a deterministic mock. No network, no API key, identical
 *   output every run. Everything that has to pass in CI scores against this.
 * - `JUDGE_MODEL` is a real model, used only by LLM-judge scorers and the
 *   Studio surface. Judges are non-deterministic, which is exactly why they
 *   are kept out of the CI-gated path.
 *
 * The split is the point: deterministic code scorers gate merges, LLM judges
 * grade quality on sampled traffic.
 */

/** Canonical model id — see docs/src/plugins/remark-model-tokens/models.ts */
export const JUDGE_MODEL = 'openai/gpt-5-mini';

/** True when a real model can be reached. LLM-judge exercises skip without it. */
export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Deterministic v2 mock model.
 *
 * Answers from a tiny fixed knowledge base so that outputs are stable *and*
 * meaningfully gradeable — an echo-only mock cannot fail a relevance check in
 * an interesting way, which makes for a boring scorer demo.
 */
export function echoModel(knowledge: Record<string, string> = {}) {
  const answerFor = (question: string): string => {
    const q = question.toLowerCase();
    for (const [key, answer] of Object.entries(knowledge)) {
      if (q.includes(key.toLowerCase())) return answer;
    }
    return `I don't have information about that. Question was: ${question}`;
  };

  const lastUserText = (prompt: any[]): string => {
    const lastUser = [...prompt].reverse().find((m: any) => m.role === 'user');
    if (typeof lastUser?.content === 'string') return lastUser.content;
    return lastUser?.content?.find?.((p: any) => p.type === 'text')?.text ?? '';
  };

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-support-agent',
    doGenerate: async ({ prompt }: any) => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      content: [{ type: 'text' as const, text: answerFor(lastUserText(prompt)) }],
      warnings: [],
    }),
    doStream: async ({ prompt }: any) => {
      const delta = answerFor(lastUserText(prompt));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'r1',
              modelId: 'mock-support-agent',
              timestamp: new Date(0),
            });
            controller.enqueue({ type: 'text-start', id: 't1' });
            controller.enqueue({ type: 'text-delta', id: 't1', delta });
            controller.enqueue({ type: 'text-end', id: 't1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            });
            controller.close();
          },
        }),
      };
    },
  };
}
