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

/** Context passed to `onResult` alongside the typed answers. */
export interface ClassifierResultContext<Q extends ClassifierQuestions> {
  /** Where the text came from. */
  phase: 'input' | 'output' | 'stream';
  /** Full classifier result, including probability distributions, usage, and provider metadata. */
  result: ClassifierResult<Q>;
  /** Abort the request with a TripWire. The reason is what the caller sees; never pass model output. */
  abort: (reason?: string) => never;
  /** Drop this message (input/output) or skip emitting this chunk (stream) and continue. */
  filter: () => void;
}

/**
 * Called with the typed answers after each classification. Call `abort(reason)` to tripwire,
 * `filter()` to drop the content, or neither to let it through.
 */
export type ClassifierOnResult<Q extends ClassifierQuestions> = (
  answers: ClassifierAnswers<Q>,
  context: ClassifierResultContext<Q>,
) => void | Promise<void>;

interface ClassifierProcessorBaseOptions<Q extends ClassifierQuestions> extends LastMessageOnlyOption {
  /** Processor id. Default: 'classifier'. */
  id?: string;
  /** Receives the answers and decides what to do. Application policy lives here. */
  onResult: ClassifierOnResult<Q>;
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

/** Options when passing a `Classifier` instance with configured questions. */
export interface ClassifierProcessorInstanceOptions<
  Q extends ClassifierQuestions,
> extends ClassifierProcessorBaseOptions<Q> {
  classifier: Classifier<Q>;
}

/** Options when referencing a classifier registered on Mastra by key or id. */
export interface ClassifierProcessorRegisteredOptions<
  Q extends ClassifierQuestions = ClassifierQuestions,
> extends ClassifierProcessorBaseOptions<Q> {
  classifier: string;
}

export type ClassifierProcessorOptions<Q extends ClassifierQuestions> =
  | ClassifierProcessorInstanceOptions<Q>
  | ClassifierProcessorRegisteredOptions<Q>;

/**
 * Runs a `Classifier` over agent input, output, or stream chunks and hands the typed answers
 * to `onResult`, which can `abort` (tripwire), `filter` (drop the content), or do nothing.
 */
export class ClassifierProcessor<
  const Q extends ClassifierQuestions = ClassifierQuestions,
> implements Processor<string> {
  readonly id: string;
  readonly name = 'Classifier';

  private classifierOrId: Classifier<any> | string;
  private resolvedClassifier?: Classifier<any>;
  private onResult: ClassifierOnResult<Q>;
  private errorStrategy: ModelErrorStrategy;
  private chunkWindow: number;
  private maxInputLength?: number;
  private providerOptions?: SharedV4ProviderOptions;
  private lastMessageOnly: boolean;
  private mastra?: Mastra;

  constructor(options: ClassifierProcessorInstanceOptions<Q>);
  constructor(options: ClassifierProcessorRegisteredOptions<Q>);
  constructor(options: ClassifierProcessorOptions<Q>) {
    this.id = options.id ?? 'classifier';
    this.classifierOrId = options.classifier;
    this.onResult = options.onResult;
    this.errorStrategy = options.errorStrategy ?? 'warn';
    this.chunkWindow = options.chunkWindow ?? 0;
    this.maxInputLength = options.maxInputLength;
    this.providerOptions = options.providerOptions;
    this.lastMessageOnly = options.lastMessageOnly ?? false;

    if (typeof this.classifierOrId !== 'string') {
      if (this.classifierOrId.questions === undefined) {
        throw new MastraError({
          id: 'CLASSIFIER_PROCESSOR_QUESTIONS_REQUIRED',
          domain: ErrorDomain.MASTRA,
          category: ErrorCategory.USER,
          text: `ClassifierProcessor '${this.id}' requires a Classifier with configured questions.`,
        });
      }
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
    const filtered = await this.classify(text, 'stream', abort, observabilityContext);
    return filtered ? null : part;
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

      const filtered = await this.classify(text, phase, abort, observabilityContext);
      if (!filtered) {
        passed.push(message);
      }
    }

    return passed;
  }

  /**
   * Evaluate text and run `onResult`. Returns `true` when the content should be dropped.
   * Aborts never return. Classifier failures return `false` under 'warn'.
   */
  private async classify(
    text: string,
    phase: 'input' | 'output' | 'stream',
    abort: (reason?: string) => never,
    observabilityContext: ObservabilityContext,
  ): Promise<boolean> {
    const state = this.maxInputLength !== undefined ? text.slice(0, this.maxInputLength) : text;

    let result: ClassifierResult<Q>;
    try {
      const classifier = this.resolveClassifier();
      result = (await executeWithContext({
        span: observabilityContext.tracing.currentSpan,
        fn: () => classifier.evaluate({ state, providerOptions: this.providerOptions }),
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
      return false;
    }

    let filtered = false;
    await this.onResult(result.answers, {
      phase,
      result,
      abort,
      filter: () => {
        filtered = true;
      },
    });
    return filtered;
  }

  private resolveClassifier(): Classifier<ClassifierQuestions> {
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

    const classifier = this.mastra.getClassifierById(id);
    if (classifier.questions === undefined) {
      throw new MastraError({
        id: 'CLASSIFIER_PROCESSOR_QUESTIONS_REQUIRED',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ClassifierProcessor '${this.id}' requires classifier '${id}' to have configured questions.`,
      });
    }
    this.resolvedClassifier = classifier;
    return classifier;
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
