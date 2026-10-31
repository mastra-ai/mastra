import type { MastraDBMessage } from '../../agent/message-list';
import type { TripWire } from '../../agent/trip-wire';
import type { ClassifierDecision, ClassifierDecisionIds, ClassifierQuestions, ClassifierState } from '../../classifier';
import { parseMemoryRequestContext } from '../../memory/types';
import type { ObservabilityContext } from '../../observability';
import { resolveExportedSpanId } from '../../observability';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { RequestContext } from '../../request-context';

export type ClassifierPhase = 'input' | 'output' | 'stream';

/** Tripwire metadata when the classifier call fails and `errorStrategy` is 'strict'. */
export interface ClassifierProcessorErrorMetadata {
  processorId: string;
  classifierId: string;
  code: 'CLASSIFIER_FAILED';
}

type DecisionTripwire = { reason: string; metadata?: unknown };

/** One classification by `ClassifierProcessor`, passed to `onDecision`. */
export type ClassifierProcessorDecision<Q extends ClassifierQuestions> = ClassifierDecision<Q> & {
  processorId: string;
  phase: ClassifierPhase;
  /** 'filtered' when `onResult` called `filter()`, 'aborted' when the request was stopped with a tripwire. */
  outcome: 'allowed' | 'filtered' | 'aborted';
  /** Set when `outcome` is 'aborted'. Same reason and metadata as the tripwire the caller gets. */
  tripwire?: DecisionTripwire;
  requestContext?: RequestContext;
};

/**
 * Receives each decision after its outcome is known, including failed classifier calls. It can't change
 * the outcome, and errors it throws are logged and ignored. The processor waits for it before passing
 * the content on, once per text chunk in the stream phase, so a slow write delays the stream.
 */
export type ClassifierOnDecision<Q extends ClassifierQuestions> = (
  decision: ClassifierProcessorDecision<Q>,
) => void | Promise<void>;

/** What a call site knows about the classification it reports. */
type DecisionDetails<Q extends ClassifierQuestions> = Omit<
  ClassifierProcessorDecision<Q>,
  'processorId' | 'classifierId' | 'phase' | 'state' | 'requestContext' | 'ids'
>;

export type ReportDecision<Q extends ClassifierQuestions> = (details: DecisionDetails<Q>) => Promise<void>;

/**
 * Returns a function that sends one decision to `onDecision`. Ids are only read when `onDecision` is set.
 */
export function createDecisionReporter<Q extends ClassifierQuestions>({
  onDecision,
  processorId,
  classifierId,
  phase,
  state,
  requestContext,
  getIds,
}: {
  onDecision?: ClassifierOnDecision<Q>;
  processorId: string;
  classifierId: string;
  phase: ClassifierPhase;
  state: ClassifierState;
  requestContext?: RequestContext;
  getIds: () => ClassifierDecisionIds;
}): ReportDecision<Q> {
  return async details => {
    if (!onDecision) return;
    const decision = { ...details, processorId, classifierId, phase, state, requestContext, ids: getIds() };
    try {
      await onDecision(decision as ClassifierProcessorDecision<Q>);
    } catch (error) {
      console.warn(`[ClassifierProcessor:${processorId}] onDecision failed:`, error);
    }
  };
}

/** The tripwire as the caller receives it, including the runner's default reason. */
export function tripwireOf(error: TripWire): DecisionTripwire {
  return {
    reason: error.message,
    metadata: error.options.metadata,
  };
}

export function messageDecisionIds(
  message: MastraDBMessage,
  requestContext: RequestContext | undefined,
  observabilityContext: ObservabilityContext,
): ClassifierDecisionIds {
  return {
    messageId: message.id,
    ...memoryIds(requestContext, message),
    ...traceIds(observabilityContext),
  };
}

export function streamDecisionIds(
  runId: string,
  requestContext: RequestContext | undefined,
  observabilityContext: ObservabilityContext,
): ClassifierDecisionIds {
  return {
    runId,
    ...memoryIds(requestContext),
    ...traceIds(observabilityContext),
  };
}

/**
 * Thread and resource of the run. The agent's memory context wins over the message, because a message
 * recalled from another thread of the same resource keeps that thread's id.
 */
function memoryIds(
  requestContext: RequestContext | undefined,
  message?: MastraDBMessage,
): Pick<ClassifierDecisionIds, 'threadId' | 'resourceId'> {
  const memory = parseMemoryRequestContext(requestContext);
  const threadId = memory?.thread?.id ?? message?.threadId ?? requestContext?.getRaw(MASTRA_THREAD_ID_KEY);
  const resourceId = memory?.resourceId ?? message?.resourceId ?? requestContext?.getRaw(MASTRA_RESOURCE_ID_KEY);
  return {
    threadId: typeof threadId === 'string' ? threadId : undefined,
    resourceId: typeof resourceId === 'string' ? resourceId : undefined,
  };
}

function traceIds(observabilityContext: ObservabilityContext): Pick<ClassifierDecisionIds, 'traceId' | 'spanId'> {
  const span = observabilityContext.tracing.currentSpan;
  // Unsampled runs get a no-op span, which belongs to no exported trace.
  if (!span?.isValid) return {};

  return {
    traceId: span.traceId,
    spanId: resolveExportedSpanId(span),
  };
}
