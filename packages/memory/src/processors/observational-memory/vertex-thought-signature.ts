import type { MastraDBMessage } from '@mastra/core/agent';

type PartWithProviderMetadata = {
  type: string;
  providerMetadata?: {
    vertex?: { thoughtSignature?: string };
    google?: { thoughtSignature?: string };
    [key: string]: unknown;
  };
};

function readThoughtSignatureFromPart(part: PartWithProviderMetadata): string | undefined {
  const meta = part.providerMetadata;
  if (!meta) return undefined;
  return meta.vertex?.thoughtSignature ?? meta.google?.thoughtSignature;
}

function toolInvocationHasThoughtSignature(part: PartWithProviderMetadata): boolean {
  return !!readThoughtSignatureFromPart(part);
}

function writeVertexThoughtSignature(part: PartWithProviderMetadata, signature: string): void {
  if (!part.providerMetadata) {
    part.providerMetadata = {};
  }
  if (!part.providerMetadata.vertex) {
    part.providerMetadata.vertex = {};
  }
  part.providerMetadata.vertex.thoughtSignature = signature;
}

/**
 * Gemini (Vertex) streaming often emits `thoughtSignature` only on the first parallel
 * tool call. Observational Memory splits assistant tool calls into separate messages, so
 * each becomes its own API content block — blocks where every function call lacks a
 * signature are rejected (400). Copy the most recent prior signature onto
 * `tool-invocation` parts that are missing one so the reconstructed history validates.
 *
 * Only assistant messages are updated. `lastKnown` resets on each `user` message so
 * signatures from an earlier model turn are not applied after tool results or a new
 * user message.
 *
 * Mutates message objects in place so the same list the agent sends to the model is
 * updated; copying would detach edits from `MessageList` storage.
 *
 * @see https://github.com/mastra-ai/mastra/issues/15294
 */
export function propagateVertexThoughtSignaturesToToolInvocations(messages: MastraDBMessage[]): void {
  let lastKnown: string | undefined;

  for (const msg of messages) {
    if (msg.role === 'user') {
      lastKnown = undefined;
    }
    if (msg.role !== 'assistant') {
      continue;
    }

    const parts = msg.content?.parts;
    if (!parts?.length) continue;

    for (const part of parts) {
      const typed = part as PartWithProviderMetadata;
      const sig = readThoughtSignatureFromPart(typed);
      if (sig) {
        lastKnown = sig;
      }

      if (typed.type !== 'tool-invocation') {
        continue;
      }

      if (toolInvocationHasThoughtSignature(typed)) {
        continue;
      }

      if (lastKnown) {
        writeVertexThoughtSignature(typed, lastKnown);
      }
    }
  }
}
