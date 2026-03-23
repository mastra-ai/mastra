import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MastraDBMessage, MessageList } from '@mastra/core/agent';
import { parseMemoryRequestContext } from '@mastra/core/memory';
import type { ProcessInputStepArgs } from '@mastra/core/processors';
import type { BufferedObservationChunk, ObservationalMemoryRecord } from '@mastra/core/storage';

const OM_REPRO_CAPTURE_DIR = process.env.OM_REPRO_CAPTURE_DIR ?? '.mastra-om-repro';

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
      if (current instanceof Error) return { name: current.name, message: current.message, stack: current.stack };
      if (current instanceof Set) return { __type: 'Set', values: Array.from(current.values()) };
      if (current instanceof Map) return { __type: 'Map', entries: Array.from(current.entries()) };
      return current;
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
  debug?: (message: string) => void;
}) {
  if (!isOmReproCaptureEnabled()) {
    return;
  }

  try {
    const sanitizedThreadId = sanitizeCapturePathSegment(params.threadId);
    const runId = `${Date.now()}-step-${params.stepNumber}-${randomUUID()}`;
    const captureDir = join(process.cwd(), OM_REPRO_CAPTURE_DIR, sanitizedThreadId, runId);
    mkdirSync(captureDir, { recursive: true });

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
    const inputPayload = safeCaptureJson({
      stepNumber: params.stepNumber,
      threadId: params.threadId,
      resourceId: params.resourceId,
      readOnly: memoryContext?.memoryConfig?.readOnly,
      messageCount: contextMessages.length,
      messageIds: contextMessages.map(message => message.id),
      stateKeys: Object.keys(rawState),
      state: rawState,
      args: {
        messages: params.args.messages,
        steps: params.args.steps,
        systemMessages: params.args.systemMessages,
        retryCount: params.args.retryCount,
        tools: params.args.tools,
        toolChoice: params.args.toolChoice,
        activeTools: params.args.activeTools,
        providerOptions: params.args.providerOptions,
        modelSettings: params.args.modelSettings,
        structuredOutput: params.args.structuredOutput,
      },
    });

    const preStatePayload = safeCaptureJson({
      record: params.preRecord,
      bufferedChunks: params.preBufferedChunks,
      contextTokenCount: params.preContextTokenCount,
      messages: params.preMessages,
      messageList: params.preSerializedMessageList,
    });

    const outputPayload = safeCaptureJson({
      details: params.details,
      messageDiff: {
        removedMessageIds,
        addedMessageIds,
        idRemap,
      },
    });

    const postStatePayload = safeCaptureJson({
      record: params.postRecord,
      bufferedChunks: params.postBufferedChunks,
      contextTokenCount: params.postContextTokenCount,
      messageCount: contextMessages.length,
      messageIds: contextMessages.map(message => message.id),
      messages: contextMessages,
      messageList: params.messageList.serialize(),
    });

    writeFileSync(join(captureDir, 'input.json'), `${JSON.stringify(inputPayload, null, 2)}\n`);
    writeFileSync(join(captureDir, 'pre-state.json'), `${JSON.stringify(preStatePayload, null, 2)}\n`);
    writeFileSync(join(captureDir, 'output.json'), `${JSON.stringify(outputPayload, null, 2)}\n`);
    writeFileSync(join(captureDir, 'post-state.json'), `${JSON.stringify(postStatePayload, null, 2)}\n`);

    params.debug?.(`[OM:repro-capture] wrote processInputStep capture to ${captureDir}`);
  } catch (error) {
    params.debug?.(`[OM:repro-capture] failed to write processInputStep capture: ${String(error)}`);
  }
}
