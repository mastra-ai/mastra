import { z } from 'zod/v4';
import type { MastraDBMessage } from '../../agent/message-list';
import type { RequestContext } from '../../request-context';
import type { Processor } from '../index';
import { handleModelError } from './model-error-strategy';
import type { ModelErrorStrategy } from './model-error-strategy';

/**
 * The verdict an evaluation model returns for one piece of text.
 */
export interface EvaluationVerdict {
  /** Probability that the text must be blocked (0-1). */
  score: number;
  /** Optional category label. Used for logging only — never decides the outcome. */
  category?: string;
  /** Resolved model id, when the evaluator reports one. */
  model?: string;
  /** Input tokens billed, when the evaluator reports usage. */
  tokensIn?: number;
}

/**
 * A call to an evaluation model — a classifier that answers typed questions
 * and emits no text (e.g. TypeSafe Jev). Implement it directly, or build one
 * with {@link createJevEvaluator}.
 */
export type EvaluationModerationEvaluate = (text: string, signal: AbortSignal) => Promise<EvaluationVerdict>;

/**
 * Configuration options for EvaluationModerationProcessor
 */
export interface EvaluationModerationOptions {
  /**
   * The evaluation call. Receives the text of the last message (truncated to
   * `maxChars`) and an abort signal capped at `timeoutMs`; resolves with a
   * verdict, or throws on timeout/transport/parse failure.
   */
  evaluate: EvaluationModerationEvaluate;

  /**
   * Block when the verdict's score is greater than or equal to this value
   * (0-1, default: 0.7)
   */
  threshold?: number;

  /**
   * Reason passed to `abort()` when content is blocked. Mastra puts it into
   * the tripwire verbatim. A fixed code — not model-generated text — lets
   * callers distinguish a moderation block from other stops.
   * Default: 'MESSAGE_BLOCKED'
   */
  reason?: string;

  /**
   * Maximum characters of the message sent for evaluation (default: 8000).
   * Evaluation models reject oversized inputs — Jev refuses requests over
   * 32k tokens — so the text is truncated rather than failing the call.
   */
  maxChars?: number;

  /**
   * Deadline for one evaluation call in milliseconds (default: 5000). A slow
   * moderator must not become the chat's latency.
   */
  timeoutMs?: number;

  /**
   * Circuit breaker: after `threshold` consecutive evaluation failures
   * (default: 3), calls stop for `cooldownMs` (default: 60000) so a down
   * vendor adds no latency. While open, messages pass unevaluated.
   */
  breaker?: {
    threshold?: number;
    cooldownMs?: number;
  };

  /**
   * How evaluation failures are handled. 'warn' fails open: the failure is
   * logged and the message goes through unevaluated. 'strict' fails closed:
   * processing stops with a tripwire. Default: 'warn'.
   */
  errorStrategy?: ModelErrorStrategy;

  /**
   * Called after every answered evaluation, blocked or not — for cost
   * accounting and metrics. The verdict carries `tokensIn` and `model` when
   * the evaluator reports them.
   */
  onVerdict?: (verdict: EvaluationVerdict) => void;

  /**
   * Clock override for testing the circuit breaker. Defaults to Date.now.
   */
  now?: () => number;
}

/**
 * EvaluationModerationProcessor guards agent input with an evaluation model —
 * a classifier-style model that returns typed answers (a probability, a
 * one-of-N choice) instead of generated text.
 *
 * Unlike {@link ModerationProcessor}, which asks a language model for a
 * verdict and parses it out of generated text, this processor accepts an
 * `evaluate` function so it can be backed by evaluation models that cannot
 * plug into an Agent's model slot.
 *
 * Behavior, once per turn in `processInput`:
 *
 * 1. Takes the text of the last message only — not history, tool results, or
 *    attachments — truncated to `maxChars`;
 * 2. Evaluates it and aborts the turn with `reason` when the score is at or
 *    above `threshold`;
 * 3. Fails open on evaluation failure: timeout, transport error, or an open
 *    circuit breaker lets the message through with one log line.
 *
 * The message text is never logged.
 */
export class EvaluationModerationProcessor implements Processor<'evaluation-moderation'> {
  readonly id = 'evaluation-moderation';
  readonly name = 'Evaluation Moderation';

  private evaluate: EvaluationModerationEvaluate;
  private threshold: number;
  private reason: string;
  private maxChars: number;
  private timeoutMs: number;
  private breakerThreshold: number;
  private breakerCooldownMs: number;
  private errorStrategy: ModelErrorStrategy;
  private onVerdict?: (verdict: EvaluationVerdict) => void;
  private now: () => number;

  private consecutiveFailures = 0;
  private breakerOpenUntil = 0;

  constructor(options: EvaluationModerationOptions) {
    this.evaluate = options.evaluate;
    this.threshold = options.threshold ?? 0.7;
    this.reason = options.reason ?? 'MESSAGE_BLOCKED';
    this.maxChars = options.maxChars ?? 8000;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.breakerThreshold = options.breaker?.threshold ?? 3;
    this.breakerCooldownMs = options.breaker?.cooldownMs ?? 60_000;
    this.errorStrategy = options.errorStrategy ?? 'warn';
    this.onVerdict = options.onVerdict;
    this.now = options.now ?? Date.now;
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
    abortSignal?: AbortSignal;
  }): Promise<MastraDBMessage[]> {
    const { messages, abort } = args;
    const text = this.extractLastMessageText(messages).slice(0, this.maxChars);
    if (!text) {
      // Nothing to judge — pass unchecked
      return messages;
    }

    let verdict: EvaluationVerdict;
    try {
      verdict = await this.evaluateWithResilience(text, args.abortSignal);
    } catch (error) {
      handleModelError({
        error,
        errorStrategy: this.errorStrategy,
        abort,
        warningMessage: '[EvaluationModerationProcessor] Evaluation returned no verdict, allowing content:',
        abortMessage: 'Moderation failed because the evaluation call failed',
      });
      // Fail open - allow content through if evaluation failed
      return messages;
    }

    try {
      this.onVerdict?.(verdict);
    } catch (error) {
      console.warn('[EvaluationModerationProcessor] onVerdict callback failed:', error);
    }

    if (verdict.score < this.threshold) {
      return messages;
    }

    console.warn(
      `[EvaluationModerationProcessor] Blocked a message (category: ${verdict.category ?? 'none'}, score: ${verdict.score}, model: ${verdict.model ?? 'unknown'})`,
    );
    return abort(this.reason);
  }

  /**
   * Deadline + circuit breaker around the evaluation call. The deadline caps
   * one call; the breaker stops calling an evaluator that is down, so turns
   * fail fast instead of each waiting out the deadline.
   */
  private async evaluateWithResilience(text: string, abortSignal?: AbortSignal): Promise<EvaluationVerdict> {
    if (this.now() < this.breakerOpenUntil) {
      throw new Error('Evaluation circuit breaker is open');
    }

    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = abortSignal ? AbortSignal.any([timeout, abortSignal]) : timeout;

    try {
      const verdict = await this.evaluate(text, signal);
      if (this.consecutiveFailures >= this.breakerThreshold) {
        console.warn('[EvaluationModerationProcessor] Evaluation recovered, moderation resumed');
      }
      this.consecutiveFailures = 0;
      return verdict;
    } catch (error) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures === this.breakerThreshold) {
        this.breakerOpenUntil = this.now() + this.breakerCooldownMs;
        console.warn(
          '[EvaluationModerationProcessor] Evaluation unavailable, skipping moderation until the cooldown expires:',
          error,
        );
      }
      throw error;
    }
  }

  /**
   * Text parts of the last message joined with a space; when there are none,
   * the legacy `content.content` string — the same fallback ModerationProcessor
   * reads. Empty means "nothing to judge" and passes unchecked.
   */
  private extractLastMessageText(messages: MastraDBMessage[]): string {
    const content = messages.at(-1)?.content;
    let text = '';
    if (content?.parts) {
      for (const part of content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += part.text + ' ';
        }
      }
    }
    if (!text.trim() && typeof content?.content === 'string') {
      text = content.content;
    }
    return text.trim();
  }
}

/**
 * Tells a moderation block from an ordinary stop: a user-stopped run carries a
 * tripwire too, with a different reason, so "any tripwire" is not a block.
 */
export const isModerationBlock = (tripwire: { reason: string } | undefined, reason = 'MESSAGE_BLOCKED'): boolean =>
  tripwire?.reason === reason;

// ---------------------------------------------------------------------------
// TypeSafe Jev evaluator
// ---------------------------------------------------------------------------

export const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JEV_MODEL = 'jev-latest';

/**
 * A yes/no question. The API calls this type `noul`; its answer is a number,
 * P(true). `criteria` describes what counts as `true` and as `false`.
 */
export interface JevBooleanQuestion {
  type: 'noul';
  instructions: string;
  criteria: { true: string; false: string };
}

/**
 * A one-of-N question. The options go in `criteria` (option -> description),
 * not in an `options` field — the API answers 422 to the latter.
 */
export interface JevChoiceQuestion {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
}

export interface JevRequest {
  questions: Record<string, JevBooleanQuestion | JevChoiceQuestion>;
  /** Named values the questions refer to by name, e.g. `message`. */
  state: Record<string, unknown>;
}

/** Category -> description. `none` is added automatically. */
export const JEV_DEFAULT_CATEGORIES: Record<string, string> = {
  harassment: 'Harassment or abuse aimed at a person or at the assistant.',
  hate: 'Hate towards a group.',
  illicit: 'Help with something unlawful.',
  'self-harm': 'Self-harm.',
  sexual: 'Sexual content.',
  'sexual/minors': 'Sexual content involving a minor.',
  violence: "Aims to harm or threaten a person, or to destroy someone's property.",
};

/**
 * The gate's criteria. Write your domain's carve-outs into `allow`: what
 * separates a dangerous subject from a dangerous request is the aim, not the
 * vocabulary, and a moderator without carve-outs will block e.g. "which norms
 * govern explosive demolition of a building?" for its words.
 */
export const JEV_DEFAULT_POLICY = {
  allow:
    'An ordinary request, however harsh its vocabulary sounds when the aim is legitimate work, study or safety. Also instructions addressed to the assistant itself — restating conditions, telling it what to assume or how to answer. Also casual expletives used as emphasis rather than aimed at someone.',
  block:
    "The message pursues a harmful aim: harming or threatening a person, destroying someone's property, obtaining help with something unlawful (weapons, explosives against people, drugs, forged documents), hate or harassment aimed at a person or at the assistant, sexual content, anything sexual involving a minor, or self-harm.",
};

const JEV_NO_CATEGORY = 'none';

const jevAnswerSchema = z.object({
  answers: z.object({
    blocking: z.object({ noul: z.number() }),
    // Optional on purpose: a missing label must not turn a block into a pass.
    category: z.object({ choice: z.string() }).optional(),
  }),
  model: z.string().optional(),
  usage: z.object({ input_tokens: z.number() }).optional(),
});

/**
 * Configuration options for createJevEvaluator
 */
export interface JevEvaluatorOptions {
  /** TypeSafe API key (`TYPESAFE_API_KEY`). */
  apiKey: string;
  /** One sentence about your assistant and its users; sharpens the verdicts. */
  context?: string;
  /** Gate criteria: what passes and what must be blocked. */
  policy?: { allow: string; block: string };
  /** Category -> description for the label Jev reports. */
  categories?: Record<string, string>;
  /** Defaults to https://api.typesafe.ai/v1/systemone. */
  endpoint?: string;
  /** Defaults to jev-latest. */
  model?: string;
  /** Fetch override for testing. */
  fetchFn?: typeof fetch;
}

/**
 * Builds an {@link EvaluationModerationEvaluate} backed by TypeSafe Jev's
 * System One API: one request per call, two questions — `blocking` (a yes/no
 * probability, the gate) and `category` (a choice label used only for
 * logging, optional in parsing so a missing label never turns a block into a
 * pass). Throws on HTTP errors and unparsable answers; the processor decides
 * what a missing verdict means.
 */
export function createJevEvaluator(options: JevEvaluatorOptions): EvaluationModerationEvaluate {
  const fetchFn = options.fetchFn ?? fetch;
  const context = options.context === undefined ? '' : `${options.context} `;
  const policy = options.policy ?? JEV_DEFAULT_POLICY;

  return async (text: string, signal: AbortSignal): Promise<EvaluationVerdict> => {
    const request: JevRequest & { model: string } = {
      model: options.model ?? JEV_MODEL,
      questions: {
        blocking: {
          type: 'noul',
          instructions: `${context}\`message\` is what a user typed to the assistant. Must \`message\` be blocked before it reaches the assistant?`,
          criteria: { false: policy.allow, true: policy.block },
        },
        category: {
          type: 'choice',
          instructions: `${context}Which policy category does \`message\` fall into?`,
          criteria: {
            ...(options.categories ?? JEV_DEFAULT_CATEGORIES),
            [JEV_NO_CATEGORY]: 'No violation: an ordinary request or ordinary talk.',
          },
        },
      },
      state: { message: text },
    };

    const response = await fetchFn(options.endpoint ?? JEV_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      // The response body can quote the request — the user's message — so it
      // is never included in the error.
      throw new Error(`jev: HTTP ${response.status}`);
    }

    const parsed = jevAnswerSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error('jev: no parsable verdict');
    }
    return {
      score: parsed.data.answers.blocking.noul,
      category: parsed.data.answers.category?.choice ?? JEV_NO_CATEGORY,
      model: parsed.data.model ?? options.model ?? JEV_MODEL,
      tokensIn: parsed.data.usage?.input_tokens,
    };
  };
}
