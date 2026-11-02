/**
 * Moves a request to the next model-route entry when the model refuses it on
 * safety grounds.
 *
 * Anthropic reports a refusal as a successful step that finishes with
 * `content-filter`, a terminal finish reason, so the run would stop on the
 * same model. Core's fallback walk only advances when a model attempt throws,
 * and a processor retry stays on the same model, so this processor works in
 * two halves (one instance in both lanes shares its state by id):
 *
 * 1. `processOutputStep` sees the refusal, records the hop and asks for a
 *    retry, which rolls the refused step back. It sits after
 *    `CyberRefusalHandler`, so a cyber refusal still gets that handler's one
 *    `continue` nudge first; it runs only once the nudge has been spent or for
 *    refusals the handler doesn't nudge.
 * 2. `processInputStep` on the retry announces the hop through
 *    `AccountRotationProcessor` (same transcript part, notice and sticky
 *    pending fallback as an outage hop) and throws. Core treats an earlier
 *    model's input-step failure as a model failure and moves to the next
 *    model, which reruns the input processors.
 *
 * Without a route entry after the current one nothing changes: the refusal
 * ends the turn as before. OpenAI refusals arrive as API errors and hop in
 * `AccountRotationProcessor.processAPIError`.
 */
import type { MessageList } from '@mastra/core/agent';
import type {
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputStepArgs,
  Processor,
} from '@mastra/core/processors';

import type { AccountRotationProcessor } from './account-rotation-processor.js';

const PENDING_HOP_KEY = 'refusalHopPending';

/** Thrown from the input step so core's fallback walk moves to the next model. */
export class ModelRefusedError extends Error {
  constructor() {
    super('The model refused this request; trying the next model in the route.');
    this.name = 'ModelRefusedError';
  }
}

export class RefusalFallbackProcessor implements Processor<'mastracode-refusal-fallback'> {
  readonly id = 'mastracode-refusal-fallback' as const;
  readonly name = 'Refusal Fallback';

  constructor(
    private readonly rotation: Pick<AccountRotationProcessor, 'hasNextModelRouteEntry' | 'announceModelRouteHop'>,
  ) {}

  async processOutputStep(args: ProcessOutputStepArgs): Promise<MessageList> {
    if (args.finishReason !== 'content-filter') return args.messageList;
    if (!(await this.rotation.hasNextModelRouteEntry(args))) return args.messageList;
    args.state[PENDING_HOP_KEY] = true;
    // The reason becomes the retry's system reminder, which the next model sees.
    return args.abort('continue', { retry: true });
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined> {
    if (args.state[PENDING_HOP_KEY] !== true) return undefined;
    delete args.state[PENDING_HOP_KEY];
    await this.rotation.announceModelRouteHop(args, 'refusal');
    throw new ModelRefusedError();
  }
}
