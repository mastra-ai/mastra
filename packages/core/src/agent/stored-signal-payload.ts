import { decode, encode } from '../events/codec';
import type { StoredAgentSignalPayload } from '../storage/domains/agent-signals/base';
import { convertDataContentToBase64String } from './message-list/prompt/data-content';
import { createSignal } from './signals';
import type { AgentSignalContents, AgentSignalInput, CreatedAgentSignal } from './signals';

const STORED_SIGNAL_VERSION = 1;

type FileContentPart = Extract<Exclude<AgentSignalContents, string>[number], { type: 'file' }>;

function isBinary(data: unknown): data is Uint8Array | ArrayBuffer {
  return data instanceof Uint8Array || data instanceof ArrayBuffer;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The JSON form a signal is stored in. The event codec keeps `Date`, `URL` and
 * explicit `undefined`, as it does for signals crossing the pubsub, and drops
 * the methods `createSignal` adds back on read. It has no typed-array support,
 * so binary file data is stored as base64 and the indexes of those parts are
 * kept so they are restored as bytes.
 */
export function toStoredSignalPayload(signal: CreatedAgentSignal): StoredAgentSignalPayload {
  const { toDBMessage: _toDBMessage, toLLMMessage: _toLLMMessage, toDataPart: _toDataPart, ...fields } = signal;
  const binaryParts: number[] = [];
  const contents =
    typeof fields.contents === 'string'
      ? fields.contents
      : fields.contents.map((part, index) => {
          if (part.type !== 'file' || !isBinary(part.data)) return part;
          binaryParts.push(index);
          return { ...part, data: convertDataContentToBase64String(part.data) };
        });
  return {
    version: STORED_SIGNAL_VERSION,
    signal: encode({ ...fields, contents }),
    ...(binaryParts.length ? { binaryParts } : {}),
  } as StoredAgentSignalPayload;
}

export function fromStoredSignalPayload(payload: StoredAgentSignalPayload): CreatedAgentSignal {
  // A row written by a newer release may encode the signal differently; reading it as this form would deliver
  // something else than was sent.
  if (payload.version !== STORED_SIGNAL_VERSION) {
    throw new Error(
      `Stored agent signal has format version ${JSON.stringify(payload.version)}; this version of Mastra reads version ${STORED_SIGNAL_VERSION}`,
    );
  }
  const fields = decode(payload.signal) as AgentSignalInput;
  const binaryParts = new Set((payload.binaryParts as number[] | undefined) ?? []);
  const contents =
    typeof fields.contents === 'string' || !binaryParts.size
      ? fields.contents
      : fields.contents.map((part, index) =>
          binaryParts.has(index) ? { ...part, data: base64ToBytes((part as FileContentPart).data as string) } : part,
        );
  return createSignal({ ...fields, contents });
}
