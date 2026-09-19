import type { SharedV4ProviderOptions } from '@ai-sdk/provider-v7';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { Classifier, ClassifierAnswers, ClassifierQuestions, ClassifierResult } from '../../classifier';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import type { RequestContext } from '../../request-context';
import type { ChunkType } from '../../stream';
import type { Processor } from '../index';
import { selectMessagesToCheck } from './message-selection';
import type { LastMessageOnlyOption } from './message-selection';
import { handleModelError } from './model-error-strategy';
import type { ModelErrorStrategy } from './model-error-strategy';

export type ClassifierProcessorPhase = 'input' | 'output' | 'stream';

/**
 * Decision returned by a `decide` policy function.
 *
 * - `pass`: leave the message or chunk unchanged.
 * - `block`: abort the request with a TripWire. `reason` is the exact abort message.
 * - `filter`: drop the message (input/output) or skip emitting the chunk (stream).
 */
export type ClassifierDecision = { action: 'pass' } | { action: 'block'; reason: string } | { action: 'filter' };

export type ClassifierDecide<Q extends ClassifierQuestions> = (
  answers: ClassifierAnswers<Q>,
  ctx: { phase: ClassifierProcessorPhase; result: ClassifierResult<Q> },
) => ClassifierDecision | Promise<ClassifierDecision>;

interface ClassifierProcessorBaseOptions<Q extends ClassifierQuestions> extends LastMessageOnlyOption {
  /** Processor id. Default: 'classifier'. */
  id?: string;
  /** Maps typed classifier answers to a processor decision. Application policy lives here. */
  decide: ClassifierDecide<Q>;
  /**
   * What to do when the classifier call fails.
   * - 'warn' (default): log and let the content through.
   * - 'strict': abort the request.
   */
  errorStrategy?: ModelErrorStrategy;
  /**
   * Number of preceding stream chunks to include as context when classifying a text-delta chunk.
   * 0 (default) classifies only the current chunk.
   */
  chunkWindow?: number;
  /** Truncate the text sent to the classifier to this many characters. Default: no truncation. */
  maxInputLength?: number;
  /** Provider-specific options forwarded to the evaluation model. */
  providerOptions?: SharedV4ProviderOptions;
}

/** Options when the classifier instance already has configured questions. */
export type ClassifierProcessorConfiguredOptions<Q extends ClassifierQuestions> = ClassifierProcessorBaseOptions<Q> & {
  classifier: Classifier<Q>;
  questions?: never;
};

/** Options when the classifier instance has no configured questions; questions are required. */
export type ClassifierProcessorPerCallOptions<Q extends ClassifierQuestions> = ClassifierProcessorBaseOptions<Q> & {
  classifier: Classifier<undefined>;
  questions: Q;
};

/**
 * Options when the classifier is referenced by registered key/id and resolved via `mastra.getClassifierById`.
 * Pass `questions` when the registered classifier has none configured.
 */
export type ClassifierProcessorRegisteredOptions<Q extends ClassifierQuestions> = ClassifierProcessorBaseOptions<Q> & {
  classifier: string;
  questions?: Q;
};

export type ClassifierProcessorOptions<Q extends ClassifierQuestions> =
  | ClassifierProcessorConfiguredOptions<Q>
  | ClassifierProcessorPerCallOptions<Q>
  | ClassifierProcessorRegisteredOptions<Q>;

/**
 * Runs a `Classifier` over agent input, output, or stream chunks and applies a caller-supplied
 * `decide` policy. The classifier provides typed evidence; `decide` decides what happens.
 */
export class ClassifierProcessor<const Q extends ClassifierQuestions = ClassifierQuestions>
  implements Processor<string>
{
  readonly id: string;
  readonly name = 'Classifier';

  private classifierOrId: Classifier<any> | string;
  private resolvedClassifier?: Classifier<any>;
  private questions?: Q;
  private decide: ClassifierDecide<Q>;
  private errorStrategy: ModelErrorStrategy;
  private chunkWindow: number;
  private maxInputLength?: number;
  private providerOptions?: SharedV4ProviderOptions;
  private lastMessageOnly: boolean;
  private mastra?: Mastra;

  constructor(options: ClassifierProcessorConfiguredOptions<Q>);
  constructor(options: ClassifierProcessorPerCallOptions<Q>);
  constructor(options: ClassifierProcessorRegisteredOptions<Q>);
  constructor(options: ClassifierProcessorOptions<Q>) {
    this.id = options.id ?? 'classifier';
    this.classifierOrId = options.classifier;
    this.questions = options.questions;
    this.decide = options.decide;
    this.errorStrategy = options.errorStrategy ?? 'warn';
    this.chunkWindow = options.chunkWindow ?? 0;
    this.maxInputLength = options.maxInputLength;
    this.providerOptions = options.providerOptions;
    this.lastMessageOnly = options.lastMessageOnly ?? false;

    if (typeof this.classifierOrId !== 'string') {
      this.resolvedClassifier = this.classifierOrId;
    }
  }

  __registerMastra(mastra: Mastra): void {
    this.mastra = mastra;
  }

  async processInput(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    return this.processMessages(args, 'input');
  }

  async processOutputResult(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MastraDBMessage[]> {
    return this.processMessages(args, 'output');
  }

  async processOutputStream(
    args: {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, any>;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<ChunkType | null | undefined> {
    const { part, streamParts, abort, requestContext: _requestContext, state: _state, ...rest } = args;
    if (part.type !== 'text-delta') {
      return part;
    }

    const text = this.buildContextFromChunks(streamParts);
    if (!text.trim()) {
      return part;
    }

    const observabilityContext = resolveObservabilityContext(rest);
    const decision = await this.classify(text, 'stream', abort, observabilityContext);

    if (decision.action === 'filter') {
      return null;
    }
    return part;
  }

  private async processMessages(
    args: {
      messages: MastraDBMessage[];
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
    phase: 'input' | 'output',
  ): Promise<MastraDBMessage[]> {
    const { messages, abort, requestContext: _requestContext, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);
    const messagesToCheck = selectMessagesToCheck(messages, this.lastMessageOnly);
    const checkSet = new Set(messagesToCheck);
    const passed: MastraDBMessage[] = [];

    for (const message of messages) {
      if (!checkSet.has(message)) {
        passed.push(message);
        continue;
      }

      const text = extractTextContent(message);
      if (!text) {
        passed.push(message);
        continue;
      }

      const decision = await this.classify(text, phase, abort, observabilityContext);
      if (decision.action === 'filter') {
        continue;
      }
      passed.push(message);
    }

    return passed;
  }

  /**
   * Evaluate text and apply `decide`. Returns `pass` when the classifier call fails and
   * `errorStrategy` is 'warn'. `block` decisions never return: they call `abort`.
   */
  private async classify(
    text: string,
    phase: ClassifierProcessorPhase,
    abort: (reason?: string) => never,
    observabilityContext: ObservabilityContext,
  ): Promise<ClassifierDecision> {
    const state = this.maxInputLength !== undefined ? text.slice(0, this.maxInputLength) : text;

    let result: ClassifierResult<Q>;
    try {
      const classifier = this.resolveClassifier();
      // Configured questions on the classifier always win; per-processor questions only apply when it has none.
      const questions = classifier.questions === undefined ? this.questions : undefined;
      result = (await executeWithContext({
        span: observabilityContext.tracing.currentSpan,
        fn: () =>
          questions
            ? (classifier as Classifier<undefined>).evaluate({ state, questions, providerOptions: this.providerOptions })
            : (classifier as Classifier<ClassifierQuestions>).evaluate({
                state,
                providerOptions: this.providerOptions,
              }),
      })) as ClassifierResult<Q>;
    } catch (error) {
      if (error instanceof TripWire) {
        throw error;
      }
      handleModelError({
        error,
        errorStrategy: this.errorStrategy,
        abort,
        warningMessage: `[ClassifierProcessor:${this.id}] Classifier evaluation failed, allowing content:`,
        abortMessage: 'Classification failed because the classifier call failed',
      });
      return { action: 'pass' };
    }

    const decision = await this.decide(result.answers, { phase, result });
    if (decision.action === 'block') {
      abort(decision.reason);
    }
    return decision;
  }

  private resolveClassifier(): Classifier<any> {
    if (this.resolvedClassifier) {
      return this.resolvedClassifier;
    }

    const id = this.classifierOrId as string;
    if (!this.mastra) {
      throw new MastraError({
        id: 'CLASSIFIER_PROCESSOR_MASTRA_NOT_REGISTERED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ClassifierProcessor '${this.id}' references classifier '${id}' by id, but the processor is not attached to a Mastra instance. Pass a Classifier instance or register the processor and classifier with Mastra.`,
      });
    }

    this.resolvedClassifier = this.mastra.getClassifierById(id);
    return this.resolvedClassifier;
  }

  private buildContextFromChunks(streamParts: ChunkType[]): string {
    const chunks = this.chunkWindow === 0 ? streamParts.slice(-1) : streamParts.slice(-this.chunkWindow);
    return chunks
      .filter(part => part.type === 'text-delta')
      .map(part => (part.type === 'text-delta' ? part.payload.text : ''))
      .join('');
  }
}

function extractTextContent(message: MastraDBMessage): string {
  let text = '';

  if (message.content.parts) {
    for (const part of message.content.parts) {
      if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
        text += part.text + ' ';
      }
    }
  }

  if (!text.trim() && typeof message.content.content === 'string') {
    text = message.content.content;
  }

  return text.trim();
}
