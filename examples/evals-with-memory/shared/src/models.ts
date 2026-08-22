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
 * A prompt directive this mock obeys, and the transform it applies.
 *
 * Real models read their system prompt. This one has to be *told* how, and the
 * shape of that telling is deliberately narrow: one recognisable instruction —
 * "answer without specific numbers" — and one transform that strips the
 * figures out of an answer while leaving it reading like a sentence a
 * well-meaning support agent would write.
 *
 * That is enough to make a prompt edit genuinely causal. Exercise 12 changes
 * only the instructions, and the score moves — no network, no API key, same
 * numbers on every machine in the room.
 */
const AVOID_SPECIFICS =
  /avoid (?:overwhelming|specific|exact)|without specific|no specific numbers|skip the numbers|keep (?:it|answers|things) (?:vague|general|high-level)/i;

/** Drop the figures, keep the sentence. What a "friendlier tone" edit does in practice. */
function generalise(text: string): string {
  return text
    .replace(/\b\d+(?:\.\d+)?\s*(?:GB|TB|MB)\b/gi, 'plenty of space')
    .replace(/\b\d+\s*days?\b/gi, 'a limited window')
    .replace(/\b\d+\b/g, 'several');
}

/**
 * Deterministic v2 mock model.
 *
 * Answers from a tiny fixed knowledge base so that outputs are stable *and*
 * meaningfully gradeable — an echo-only mock cannot fail a relevance check in
 * an interesting way, which makes for a boring scorer demo.
 *
 * It also reads its own system prompt (see `AVOID_SPECIFICS`). Without that,
 * editing an agent's prompt would change nothing at all here, and the entire
 * prompt-versioning exercise would be theatre: two versions, identical scores.
 * Exercises 1–11 are unaffected — their instructions do not carry the
 * directive, so they answer exactly as before.
 */
export function echoModel(knowledge: Record<string, string> = {}) {
  const answerFor = (question: string, system: string): string => {
    const q = question.toLowerCase();
    for (const [key, answer] of Object.entries(knowledge)) {
      if (q.includes(key.toLowerCase())) {
        return AVOID_SPECIFICS.test(system) ? generalise(answer) : answer;
      }
    }
    return `I don't have information about that. Question was: ${question}`;
  };

  const lastUserText = (prompt: any[]): string => {
    const lastUser = [...prompt].reverse().find((m: any) => m.role === 'user');
    if (typeof lastUser?.content === 'string') return lastUser.content;
    return lastUser?.content?.find?.((p: any) => p.type === 'text')?.text ?? '';
  };

  /** The system prompt, whichever of the two shapes it arrives in. */
  const systemText = (prompt: any[]): string =>
    prompt
      .filter((m: any) => m.role === 'system')
      .map((m: any) =>
        typeof m.content === 'string'
          ? m.content
          : (m.content ?? []).map((p: any) => p?.text ?? '').join(' '),
      )
      .join('\n');

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-support-agent',
    doGenerate: async ({ prompt }: any) => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
      content: [{ type: 'text' as const, text: answerFor(lastUserText(prompt), systemText(prompt)) }],
      warnings: [],
    }),
    doStream: async ({ prompt }: any) => {
      const delta = answerFor(lastUserText(prompt), systemText(prompt));
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

/**
 * Deterministic mock that CALLS A TOOL, for the tool-mocking exercise.
 *
 * Two turns, decided by looking at the prompt rather than by counting calls
 * (the agent loop may retry, and a counter would drift):
 *
 *   turn 1 — no tool result in the conversation yet → emit a tool call
 *   turn 2 — a tool result is present → summarise it as text
 *
 * The summary is built from whatever the tool returned, which is what makes
 * the exercise work: serve a different value through a mock and the final
 * answer changes, with no other moving parts.
 */
export function toolCallingModel(toolName = 'lookupAccount', accountId = 'acct-42') {
  /** Find a tool result anywhere in the prompt, whatever shape it arrives in. */
  const findToolResult = (prompt: any[]): any => {
    for (const message of [...prompt].reverse()) {
      const parts = Array.isArray(message?.content) ? message.content : [];
      for (const part of parts) {
        if (part?.type === 'tool-result') {
          return part.output ?? part.result ?? part.value;
        }
      }
    }
    return undefined;
  };

  /** Unwrap the {type:'json', value} envelope the tool result may be wrapped in. */
  const unwrap = (value: any): any => (value && typeof value === 'object' && 'value' in value ? value.value : value);

  const summarise = (raw: any): string => {
    const result = unwrap(raw);
    if (!result || typeof result !== 'object') return 'I could not read the account details.';
    const { plan, storageUsedGb, storageLimitGb } = result as Record<string, unknown>;
    return `Account ${accountId} is on the ${plan} plan and has used ${storageUsedGb} GB of ${storageLimitGb} GB.`;
  };

  const toolCallPart = {
    type: 'tool-call' as const,
    toolCallId: 'call-1',
    toolName,
    // `input` is a JSON *string* in the v2 content shape, not an object.
    input: JSON.stringify({ accountId }),
  };

  return {
    specificationVersion: 'v2' as const,
    provider: 'mock',
    modelId: 'mock-tool-agent',
    doGenerate: async ({ prompt }: any) => {
      const toolResult = findToolResult(prompt);
      const answered = toolResult !== undefined;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: answered ? ('stop' as const) : ('tool-calls' as const),
        usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
        content: answered
          ? [{ type: 'text' as const, text: summarise(toolResult) }]
          : [toolCallPart],
        warnings: [],
      };
    },
    doStream: async ({ prompt }: any) => {
      const toolResult = findToolResult(prompt);
      const answered = toolResult !== undefined;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({
              type: 'response-metadata',
              id: 'r1',
              modelId: 'mock-tool-agent',
              timestamp: new Date(0),
            });
            if (answered) {
              const text = summarise(toolResult);
              controller.enqueue({ type: 'text-start', id: 't1' });
              controller.enqueue({ type: 'text-delta', id: 't1', delta: text });
              controller.enqueue({ type: 'text-end', id: 't1' });
            } else {
              controller.enqueue(toolCallPart);
            }
            controller.enqueue({
              type: 'finish',
              finishReason: answered ? 'stop' : 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            });
            controller.close();
          },
        }),
      };
    },
  };
}

