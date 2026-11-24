import type { SharedV4ProviderOptions } from '@ai-sdk/provider-v7';
import type { MastraDBMessage } from '../../agent/message-list';
import { TripWire } from '../../agent/trip-wire';
import type { TripWireOptions } from '../../agent/trip-wire';
import type {
  Classifier,
  ClassifierAnswers,
  ClassifierDecisionIds,
  ClassifierQuestions,
  ClassifierResult,
} from '../../classifier';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import { executeWithContext } from '../../observability/utils';
import type { RequestContext } from '../../request-context';
import type { ChunkType } from '../../stream';
import type { Processor } from '../index';
import { createDecisionReporter, messageDecisionIds, streamDecisionIds, tripwireOf } from './classifier-decision';
import type {
  ClassifierOnDecision,
  ClassifierPhase,
  ClassifierProcessorErrorMetadata,
  ReportDecision,
} from './classifier-decision';
import { selectMessagesToCheck } from './message-selection';
import type { LastMessageOnlyOption } from './message-selection';
import { handleModelError } from './model-error-strategy';
import type { ModelErrorStrategy } from './model-error-strategy';

type RunnerAbort = (reason?: string, options?: TripWireOptions) => never;
// `retry` is left out because the agent only retries tripwires from processOutputStep, which this processor doesn't implement.
type ClassifierAbort = (reason?: string, options?: Pick<TripWireOptions, 'metadata'>) => never;

type ProcessorCallArgs = {
  abort: RunnerAbort;
  abortSignal?: AbortSignal;
  requestContext?: RequestContext;
} & Partial<ObservabilityContext>;

type ProcessMessagesArgs = ProcessorCallArgs & { messages: MastraDBMessage[] };

type ClassifyOptions = Pick<ProcessorCallArgs, 'abort' | 'abortSignal' | 'requestContext'> & {
  observabilityContext: ObservabilityContext;
  getIds: () => ClassifierDecisionIds;
};

const CLASSIFIER_FAILED_REASON = 'Classification failed because the classifier call failed';

/** Context passed to `onResult` alongside the typed answers. */
export interface ClassifierResultContext<Q extends ClassifierQuestions> {
  /** Where the text came from. */
  phase: ClassifierPhase;
  /** Full classifier result, including probability distributions, usage, and provider metadata. */
  result: ClassifierResult<Q>;
  /**
   * Abort the request with a TripWire. The reason is what the caller sees; never pass model output.
   * `options.metadata` is passed to the tripwire, for example to tell the caller which policy blocked.
   */
  abort: ClassifierAbort;
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
  /** Receives each decision with its outcome and the ids of the run, for example to write an audit record. */
  onDecision?: ClassifierOnDecision<Q>;
  /**
   * What to do when the classifier call fails.
   * - 'strict' (default): abort the request.
   * - 'warn': log and let the content through.
   */
  errorStrategy?: ModelErrorStrategy;
  /**
   * Number of trailing stream chunks to classify, including the current text-delta chunk.
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
  private onDecision?: ClassifierOnDecision<Q>;
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
    this.onDecision = options.onDecision;
    this.errorStrategy = options.errorStrategy ?? 'strict';
    this.chunkWindow = options.chunkWindow ?? 0;
    this.maxInputLength = options.maxInputLength;
    this.providerOptions = options.providerOptions;
    this.lastMessageOnly = options.lastMessageOnly ?? false;

    if (!Number.isInteger(this.chunkWindow) || this.chunkWindow < 0) {
      throw new MastraError({
        id: 'CLASSIFIER_PROCESSOR_INVALID_CHUNK_WINDOW',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ClassifierProcessor '${this.id}' requires chunkWindow to be a non-negative integer.`,
      });
    }

    if (this.maxInputLength !== undefined && (!Number.isInteger(this.maxInputLength) || this.maxInputLength < 0)) {
      throw new MastraError({
        id: 'CLASSIFIER_PROCESSOR_INVALID_MAX_INPUT_LENGTH',
        domain: ErrorDomain.MASTRA,
        category: ErrorCategory.USER,
        text: `ClassifierProcessor '${this.id}' requires maxInputLength to be a non-negative integer.`,
      });
    }

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

  async processInput(args: ProcessMessagesArgs): Promise<MastraDBMessage[]> {
    return this.processMessages(args, 'input');
  }

  async processOutputResult(args: ProcessMessagesArgs): Promise<MastraDBMessage[]> {
    return this.processMessages(args, 'output');
  }

  async processOutputStream(
    args: ProcessorCallArgs & {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, any>;
    },
  ): Promise<ChunkType | null | undefined> {
    const { part, streamParts, abort, abortSignal, requestContext, state: _state, ...rest } = args;
    if (part.type !== 'text-delta') {
      return part;
    }

    const text = this.buildContextFromChunks(streamParts);
    if (!text.trim()) {
      return part;
    }

    const observabilityContext = resolveObservabilityContext(rest);
    try {
      const filtered = await this.classify(text, 'stream', {
        abort,
        abortSignal,
        requestContext,
        observabilityContext,
        getIds: () => streamDecisionIds(part.runId, requestContext, observabilityContext),
      });
      return filtered ? null : part;
    } catch (error) {
      // Rethrowing would make the runner log the user's cancel as a stream error. The stream is closing anyway.
      if (isCancellation(error, abortSignal)) return null;
      throw error;
    }
  }

  private async processMessages(args: ProcessMessagesArgs, phase: 'input' | 'output'): Promise<MastraDBMessage[]> {
    const { messages, abort, abortSignal, requestContext, ...rest } = args;
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

      const filtered = await this.classify(text, phase, {
        abort,
        abortSignal,
        requestContext,
        observabilityContext,
        getIds: () => messageDecisionIds(message, requestContext, observabilityContext),
      });
      if (!filtered) {
        passed.push(message);
      }
    }

    return passed;
  }

  /**
   * Classifies the text and applies `onResult`. Returns `true` when the content should be dropped.
   * Throws when the request is aborted or the run is cancelled.
   */
  private async classify(text: string, phase: ClassifierPhase, options: ClassifyOptions): Promise<boolean> {
    const classifier = this.resolveClassifier();
    const state = this.maxInputLength === undefined ? text : text.slice(0, this.maxInputLength);
    const report = createDecisionReporter<Q>({
      onDecision: this.onDecision,
      processorId: this.id,
      classifierId: classifier.id,
      phase,
      state,
      requestContext: options.requestContext,
      getIds: options.getIds,
    });

    const startedAt = Date.now();
    let result: ClassifierResult<Q>;
    try {
      result = await this.decide(classifier, state, options);
    } catch (error) {
      if (error instanceof TripWire || isCancellation(error, options.abortSignal)) throw error;
      await this.handleClassifierFailure(error, classifier.id, Date.now() - startedAt, report, options.abort);
      return false;
    }

    return this.applyOnResult(result, phase, Date.now() - startedAt, report, options.abort);
  }

  private async decide(
    classifier: Classifier<ClassifierQuestions>,
    state: string,
    { abortSignal, observabilityContext }: ClassifyOptions,
  ): Promise<ClassifierResult<Q>> {
    const result = await executeWithContext({
      span: observabilityContext.tracing.currentSpan,
      fn: () => classifier.decide({ state, providerOptions: this.providerOptions, abortSignal }),
    });
    return result as ClassifierResult<Q>;
  }

  /** Reports the failed call, then aborts under 'strict' or logs a warning under 'warn'. */
  private async handleClassifierFailure(
    error: unknown,
    classifierId: string,
    durationMs: number,
    report: ReportDecision<Q>,
    abort: RunnerAbort,
  ): Promise<void> {
    const metadata: ClassifierProcessorErrorMetadata = {
      processorId: this.id,
      classifierId,
      code: 'CLASSIFIER_FAILED',
    };
    if (this.errorStrategy === 'strict') {
      await report({ outcome: 'aborted', error, durationMs, tripwire: { reason: CLASSIFIER_FAILED_REASON, metadata } });
    } else {
      await report({ outcome: 'allowed', error, durationMs });
    }

    handleModelError({
      error,
      errorStrategy: this.errorStrategy,
      abort: reason => abort(reason, { metadata }),
      warningMessage: `[ClassifierProcessor:${this.id}] Classifier evaluation failed, allowing content:`,
      abortMessage: CLASSIFIER_FAILED_REASON,
    });
  }

  /** Runs `onResult` and reports its outcome. Returns `true` when `onResult` called `filter()`. */
  private async applyOnResult(
    result: ClassifierResult<Q>,
    phase: ClassifierPhase,
    durationMs: number,
    report: ReportDecision<Q>,
    abort: RunnerAbort,
  ): Promise<boolean> {
    let filtered = false;
    let aborted = false;

    try {
      await this.onResult(result.answers, {
        phase,
        result,
        abort: (...args) => {
          aborted = true;
          return abort(...args);
        },
        filter: () => {
          filtered = true;
        },
      });
    } catch (error) {
      if (aborted && error instanceof TripWire) {
        await report({ outcome: 'aborted', result, durationMs, tripwire: tripwireOf(error) });
      }

      throw error;
    }

    await report({ outcome: filtered ? 'filtered' : 'allowed', result, durationMs });
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

/** A cancelled run is not a classifier failure, so it gets neither a tripwire nor a decision. */
function isCancellation(error: unknown, abortSignal: AbortSignal | undefined): boolean {
  return abortSignal?.aborted === true && !(error instanceof TripWire);
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
