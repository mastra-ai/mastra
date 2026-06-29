import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';

import type { ObserverExchange } from './observer-runner';

function getOmReproCaptureDir(): string {
  return process.env.OM_REPRO_CAPTURE_DIR ?? '.mastra-om-repro';
}

function sanitizeCapturePathSegment(value: string): string {
  const sanitized = value
    .replace(/[\\/]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .trim();
  return sanitized.length > 0 ? sanitized : 'unknown-thread';
}

export function isOmReproCaptureEnabled(): boolean {
  return process.env.OM_REPRO_CAPTURE === '1';
}

export function safeCaptureJson(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (typeof current === 'bigint') return current.toString();
      if (typeof current === 'function') return '[function]';
      if (typeof current === 'symbol') return current.toString();
      if (current instanceof Error) return { name: current.name, message: current.message, stack: current.stack };
      if (current instanceof Set) return { __type: 'Set', values: Array.from(current.values()) };
      if (current instanceof Map) return { __type: 'Map', entries: Array.from(current.entries()) };
      return current;
    }),
  );
}

function safeCaptureJsonOrError(value: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: safeCaptureJson(value) };
  } catch (error) {
    return {
      ok: false,
      error: safeCaptureJson({
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        inspected: inspect(value, { depth: 3, maxArrayLength: 20, breakLength: 120 }),
      }),
    };
  }
}

function formatCaptureDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();

  try {
    return new Date(value as string | number | Date).toISOString();
  } catch {
    return undefined;
  }
}

function summarizeOmTurn(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const turn = value as {
    threadId?: string;
    resourceId?: string;
    _started?: boolean;
    _ended?: boolean;
    _generationCountAtStart?: number;
    _record?: {
      id?: string;
      scope?: string;
      threadId?: string;
      resourceId?: string;
      createdAt?: unknown;
      updatedAt?: unknown;
      lastObservedAt?: unknown;
      generationCount?: number;
      observationTokenCount?: number;
      pendingMessageTokens?: number;
      isBufferingObservation?: boolean;
      isBufferingReflection?: boolean;
    };
    _context?: {
      messages?: unknown[];
      systemMessage?: unknown;
      continuation?: { id?: string };
      otherThreadsContext?: unknown;
      record?: { id?: string };
    };
    _currentStep?: {
      stepNumber?: number;
      _prepared?: boolean;
      _context?: {
        activated?: boolean;
        observed?: boolean;
        buffered?: boolean;
        reflected?: boolean;
        didThresholdCleanup?: boolean;
        messages?: unknown[];
        systemMessage?: unknown[];
      };
    };
  };

  return {
    __type: 'ObservationTurn',
    threadId: turn.threadId,
    resourceId: turn.resourceId,
    started: turn._started,
    ended: turn._ended,
    generationCountAtStart: turn._generationCountAtStart,
    record: turn._record
      ? {
          id: turn._record.id,
          scope: turn._record.scope,
          threadId: turn._record.threadId,
          resourceId: turn._record.resourceId,
          createdAt: formatCaptureDate(turn._record.createdAt),
          updatedAt: formatCaptureDate(turn._record.updatedAt),
          lastObservedAt: formatCaptureDate(turn._record.lastObservedAt),
          generationCount: turn._record.generationCount,
          observationTokenCount: turn._record.observationTokenCount,
          pendingMessageTokens: turn._record.pendingMessageTokens,
          isBufferingObservation: turn._record.isBufferingObservation,
          isBufferingReflection: turn._record.isBufferingReflection,
        }
      : undefined,
    context: turn._context
      ? {
          messageCount: Array.isArray(turn._context.messages) ? turn._context.messages.length : undefined,
          hasSystemMessage: Array.isArray(turn._context.systemMessage)
            ? turn._context.systemMessage.length > 0
            : Boolean(turn._context.systemMessage),
          continuationId: turn._context.continuation?.id,
          hasOtherThreadsContext: Boolean(turn._context.otherThreadsContext),
          recordId: turn._context.record?.id,
        }
      : undefined,
    currentStep: turn._currentStep
      ? {
          stepNumber: turn._currentStep.stepNumber,
          prepared: turn._currentStep._prepared,
          context: turn._currentStep._context
            ? {
                activated: turn._currentStep._context.activated,
                observed: turn._currentStep._context.observed,
                buffered: turn._currentStep._context.buffered,
                reflected: turn._currentStep._context.reflected,
                didThresholdCleanup: turn._currentStep._context.didThresholdCleanup,
                messageCount: Array.isArray(turn._currentStep._context.messages)
                  ? turn._currentStep._context.messages.length
                  : undefined,
                systemMessageCount: Array.isArray(turn._currentStep._context.systemMessage)
                  ? turn._currentStep._context.systemMessage.length
                  : undefined,
              }
            : undefined,
        }
      : undefined,
  };
}

function sanitizeCaptureState(rawState: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(rawState).map(([key, value]) => {
      if (key === '__omTurn') {
        return [key, summarizeOmTurn(value)];
      }

      return [key, value];
    }),
  );
}

function buildReproMessageFingerprint(message: MastraDBMessage): string {
  const createdAt =
    message.createdAt instanceof Date
      ? message.createdAt.toISOString()
      : message.createdAt
        ? new Date(message.createdAt).toISOString()
        : '';

  return JSON.stringify({
    role: message.role,
    createdAt,
    content: message.content,
  });
}

function inferReproIdRemap(
  preMessages: MastraDBMessage[],
  postMessages: MastraDBMessage[],
): Array<{ fromId: string; toId: string; fingerprint: string }> {
  const preByFingerprint = new Map<string, string[]>();
  const postByFingerprint = new Map<string, string[]>();

  for (const message of preMessages) {
    if (!message.id) continue;
    const fingerprint = buildReproMessageFingerprint(message);
    const list = preByFingerprint.get(fingerprint) ?? [];
    list.push(message.id);
    preByFingerprint.set(fingerprint, list);
  }

  for (const message of postMessages) {
    if (!message.id) continue;
    const fingerprint = buildReproMessageFingerprint(message);
    const list = postByFingerprint.get(fingerprint) ?? [];
    list.push(message.id);
    postByFingerprint.set(fingerprint, list);
  }

  const remap: Array<{ fromId: string; toId: string; fingerprint: string }> = [];

  for (const [fingerprint, preIds] of preByFingerprint.entries()) {
    const postIds = postByFingerprint.get(fingerprint);
    if (!postIds || preIds.length !== 1 || postIds.length !== 1) continue;

    const fromId = preIds[0];
    const toId = postIds[0];
    if (!fromId || !toId || fromId === toId) {
      continue;
    }

    remap.push({ fromId, toId, fingerprint });
  }

  return remap;
}

function createOmReproCaptureDir(threadId: string, label: string): string {
  const sanitizedThreadId = sanitizeCapturePathSegment(threadId);
  const captureDir = join(
    process.cwd(),
    getOmReproCaptureDir(),
    sanitizedThreadId,
    `${Date.now()}-${label}-${randomUUID()}`,
  );
  mkdirSync(captureDir, { recursive: true });
  return captureDir;
}

export function writeObserverExchangeReproCapture(params: {
  threadId: string;
  resourceId?: string;
  label: string;
  observerExchange?: ObserverExchange;
  details?: Record<string, unknown>;
  debug?: (message: string) => void;
}) {
  if (!isOmReproCaptureEnabled() || !params.observerExchange) {
    return;
  }

  try {
    const captureDir = createOmReproCaptureDir(params.threadId, params.label);
    const payloads = [
      {
        fileName: 'input.json',
        data: {
          threadId: params.threadId,
          resourceId: params.resourceId,
          label: params.label,
        },
      },
      {
        fileName: 'output.json',
        data: {
          details: params.details ?? {},
        },
      },
      {
        fileName: 'observer-exchange.json',
        data: params.observerExchange,
      },
    ] as const;

    const captureErrors: Array<{ fileName: string; error: unknown }> = [];

    for (const payload of payloads) {
      const serialized = safeCaptureJsonOrError(payload.data);
      if (serialized.ok) {
        writeFileSync(join(captureDir, payload.fileName), `${JSON.stringify(serialized.value, null, 2)}\n`);
        continue;
      }

      captureErrors.push({ fileName: payload.fileName, error: serialized.error });
      writeFileSync(
        join(captureDir, payload.fileName),
        `${JSON.stringify({ __captureError: serialized.error }, null, 2)}\n`,
      );
    }

    if (captureErrors.length > 0) {
      writeFileSync(join(captureDir, 'capture-error.json'), `${JSON.stringify(captureErrors, null, 2)}\n`);
      params.debug?.(
        `[OM:repro-capture] wrote ${params.label} capture with ${captureErrors.length} serialization error(s) to ${captureDir}`,
      );
      return;
    }

    params.debug?.(`[OM:repro-capture] wrote ${params.label} capture to ${captureDir}`);
  } catch (error) {
    params.debug?.(`[OM:repro-capture] failed to write ${params.label} capture: ${String(error)}`);
  }
}

export function writeProcessInputStepReproCapture(params: {
  threadId: string;
  resourceId?: string;
  stepNumber: number;
  args: ProcessInputStepArgs;
  preRecord: ObservationalMemoryRecord;
  postRecord: ObservationalMemoryRecord;
  preMessages: MastraDBMessage[];
  preBufferedChunks: BufferedObservationChunk[];
  preContextTokenCount: number;
  preSerializedMessageList: ReturnType<MessageList['serialize']>;
  postBufferedChunks: BufferedObservationChunk[];
  postContextTokenCount: number;
  messageList: MessageList;
  details: Record<string, unknown>;
  observerExchange?: ObserverExchange;
  debug?: (message: string) => void;
}) {
  if (!isOmReproCaptureEnabled()) {
    return;
  }

  try {
    const captureDir = createOmReproCaptureDir(params.threadId, `step-${params.stepNumber}`);

    const contextMessages = params.messageList.get.all.db();
    const memoryContext = parseMemoryRequestContext(params.args.requestContext);
    const preMessageIds = new Set(params.preMessages.map(message => message.id));
    const postMessageIds = new Set(contextMessages.map(message => message.id));
    const removedMessageIds = params.preMessages
      .map(message => message.id)
      .filter((id): id is string => Boolean(id) && !postMessageIds.has(id));
    const addedMessageIds = contextMessages
      .map(message => message.id)
      .filter((id): id is string => Boolean(id) && !preMessageIds.has(id));
    const idRemap = inferReproIdRemap(params.preMessages, contextMessages);

    const rawState = (params.args.state as Record<string, unknown>) ?? {};
    const sanitizedState = sanitizeCaptureState(rawState);
    const payloads = [
      {
        fileName: 'input.json',
        data: {
          stepNumber: params.stepNumber,
          threadId: params.threadId,
          resourceId: params.resourceId,
          readOnly: memoryContext?.memoryConfig?.readOnly,
          messageCount: contextMessages.length,
          messageIds: contextMessages.map(message => message.id),
          stateKeys: Object.keys(rawState),
          state: sanitizedState,
          args: {
            messages: params.args.messages,
            steps: params.args.steps,
            systemMessages: params.args.systemMessages,
            retryCount: params.args.retryCount,
            toolChoice: params.args.toolChoice,
            activeTools: params.args.activeTools,
            modelSettings: params.args.modelSettings,
            structuredOutput: params.args.structuredOutput,
          },
        },
      },
      {
        fileName: 'pre-state.json',
        data: {
          record: params.preRecord,
          bufferedChunks: params.preBufferedChunks,
          contextTokenCount: params.preContextTokenCount,
          messages: params.preMessages,
          messageList: params.preSerializedMessageList,
        },
      },
      {
        fileName: 'output.json',
        data: {
          details: params.details,
          messageDiff: {
            removedMessageIds,
            addedMessageIds,
            idRemap,
          },
        },
      },
      {
        fileName: 'post-state.json',
        data: {
          record: params.postRecord,
          bufferedChunks: params.postBufferedChunks,
          contextTokenCount: params.postContextTokenCount,
          messageCount: contextMessages.length,
          messageIds: contextMessages.map(message => message.id),
          messages: contextMessages,
          messageList: params.messageList.serialize(),
        },
      },
    ] as const;

    const captureErrors: Array<{ fileName: string; error: unknown }> = [];

    for (const payload of payloads) {
      const serialized = safeCaptureJsonOrError(payload.data);
      if (serialized.ok) {
        writeFileSync(join(captureDir, payload.fileName), `${JSON.stringify(serialized.value, null, 2)}\n`);
        continue;
      }

      captureErrors.push({ fileName: payload.fileName, error: serialized.error });
      writeFileSync(
        join(captureDir, payload.fileName),
        `${JSON.stringify({ __captureError: serialized.error }, null, 2)}\n`,
      );
    }

    // Write observer exchange (prompt + raw LLM response) if available
    if (params.observerExchange) {
      const serialized = safeCaptureJsonOrError(params.observerExchange);
      if (serialized.ok) {
        writeFileSync(join(captureDir, 'observer-exchange.json'), `${JSON.stringify(serialized.value, null, 2)}\n`);
      } else {
        captureErrors.push({ fileName: 'observer-exchange.json', error: serialized.error });
        writeFileSync(
          join(captureDir, 'observer-exchange.json'),
          `${JSON.stringify({ __captureError: serialized.error }, null, 2)}\n`,
        );
      }
    }

    if (captureErrors.length > 0) {
      writeFileSync(join(captureDir, 'capture-error.json'), `${JSON.stringify(captureErrors, null, 2)}\n`);
      params.debug?.(
        `[OM:repro-capture] wrote processInputStep capture with ${captureErrors.length} serialization error(s) to ${captureDir}`,
      );
      return;
    }

    params.debug?.(`[OM:repro-capture] wrote processInputStep capture to ${captureDir}`);
  } catch (error) {
    params.debug?.(`[OM:repro-capture] failed to write processInputStep capture: ${String(error)}`);
  }
}
