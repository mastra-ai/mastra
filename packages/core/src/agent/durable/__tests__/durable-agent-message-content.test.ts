/**
 * Ported from validation harness case T39 (message-content).
 *
 * Non-text and multipart user content. A user message carrying an image part, a
 * file part, several text parts, or extra `context` messages must reach the
 * model in the same shape on every engine and be persisted to memory the same
 * way. The scripted model records the prompt, so the case compares the part
 * types of the first request and of the persisted user message. Model-free.
 */
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineParityResults, EngineParityScenario, ParityEngine } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape } from './parity-harness';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const FILE_BODY = Buffer.from('T39 file body').toString('base64');
const CONTEXT_TEXT = 'CONTEXT-T39 says hello';
const VARIANTS = ['image', 'file', 'multipart', 'context'] as const;
type Variant = (typeof VARIANTS)[number];
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/** Content the user message carries in each variant. */
function userContent(variant: Variant) {
  if (variant === 'image') {
    return [
      { type: 'text' as const, text: 'what is this?' },
      { type: 'image' as const, image: PNG, mimeType: 'image/png' },
    ];
  }
  if (variant === 'file') {
    return [
      { type: 'text' as const, text: 'read this' },
      { type: 'file' as const, data: FILE_BODY, mimeType: 'text/plain', filename: 't39.txt' },
    ];
  }
  if (variant === 'multipart') {
    return [
      { type: 'text' as const, text: 'part one.' },
      { type: 'text' as const, text: 'part two.' },
    ];
  }
  return 'what did the context say?';
}

type PromptMessage = CapturedRequest['prompt'][number];

/** The harness's `partTypes`: `['string']` for a plain string body, else the part types. */
function partTypes(message: PromptMessage): string[] {
  return typeof message.content === 'string' ? ['string'] : message.content.map(part => part.type);
}

/** AI SDK v5 renames `mimeType` to `mediaType` when it converts an image part to a file part. */
function mediaTypes(message: PromptMessage): unknown[] {
  if (typeof message.content === 'string') return [];
  return message.content.map(part => {
    const media = part as { mediaType?: unknown; mimeType?: unknown };
    return media.mediaType ?? media.mimeType ?? null;
  });
}

interface T39State {
  promptRoles: string[];
  lastUserParts: string[];
  persistedUserCount: number;
  /** The harness's contract `persisted` field: role + part types of every stored message. */
  persistedShape: { role: string; parts: string[] }[];
  persistedJson: string;
}

/**
 * The contract fields this case records, pinned literally for every engine.
 * The harness compares `promptRoles`, `lastUserParts` and `persisted` across
 * cells, so the values have to be pinned here — a change that moves all three
 * engines together would otherwise stay "in parity".
 */
const CONTRACT: Record<
  Variant,
  { promptRoles: string[]; lastUserParts: string[]; persistedShape: { role: string; parts: string[] }[] }
> = {
  image: {
    promptRoles: ['system', 'user'],
    lastUserParts: ['text', 'file'],
    persistedShape: [
      { role: 'user', parts: ['text', 'file'] },
      { role: 'assistant', parts: ['text'] },
    ],
  },
  file: {
    promptRoles: ['system', 'user'],
    lastUserParts: ['text', 'file'],
    persistedShape: [
      { role: 'user', parts: ['text', 'file'] },
      { role: 'assistant', parts: ['text'] },
    ],
  },
  multipart: {
    promptRoles: ['system', 'user'],
    lastUserParts: ['text', 'text'],
    persistedShape: [
      { role: 'user', parts: ['text', 'text'] },
      { role: 'assistant', parts: ['text'] },
    ],
  },
  context: {
    promptRoles: ['system', 'user', 'user'],
    lastUserParts: ['text'],
    persistedShape: [
      { role: 'user', parts: ['text'] },
      { role: 'assistant', parts: ['text'] },
    ],
  },
};

async function runT39(
  variant: Variant,
): Promise<{ results: EngineParityResults; states: Map<ParityEngine, T39State> }> {
  const memories = new Map<ParityEngine, MockMemory>();
  const thread = `t39-thread-${variant}`;
  const resource = `t39-resource-${variant}`;
  const scenario: EngineParityScenario = {
    model: { tapes: [textOnlyTape('seen')] },
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      return new Agent({ id: 't39-agent', name: 'T39 Agent', instructions: 'Look at the message.', model, memory });
    },
    input: [{ role: 'user', content: userContent(variant) }],
    options: {
      maxSteps: 2,
      runId: `t39-run-${variant}`,
      memory: { thread, resource },
      ...(variant === 'context' ? { context: [{ role: 'user' as const, content: CONTEXT_TEXT }] } : {}),
    },
  };

  const results = await expectEngineParity(scenario);
  const states = new Map<ParityEngine, T39State>();
  for (const engine of ENGINES) {
    const { messages } = await memories.get(engine)!.recall({ threadId: thread, resourceId: resource });
    const prompt = results[engine]!.requests[0]!.prompt;
    const users = prompt.filter(message => message.role === 'user');
    const lastUser = users.at(-1);
    const persistedUser = messages.filter(message => message.role === 'user');
    states.set(engine, {
      promptRoles: prompt.map(message => message.role),
      lastUserParts: lastUser ? partTypes(lastUser) : [],
      persistedUserCount: persistedUser.length,
      persistedShape: messages.map(message => ({
        role: message.role,
        parts: (message.content?.parts ?? []).map(part => part.type),
      })),
      persistedJson: JSON.stringify(messages),
    });
  }
  return { results, states };
}

describe('T39 message content (plain, durable, evented)', () => {
  for (const variant of VARIANTS) {
    it(`carries non-text content to the model and memory (${variant})`, async () => {
      const { results, states } = await runT39(variant);

      for (const engine of ENGINES) {
        const turn = results[engine]!.turns[0]!;
        const state = states.get(engine)!;
        const prompt = results[engine]!.requests[0]!.prompt;
        const lastUser = prompt.filter(message => message.role === 'user').at(-1)!;

        expect(chunksOfType(turn, 'finish'), `${engine}: one finish`).toBe(1);
        expect(turn.streamedText, `${engine}: text`).toBe('seen');
        expect(results[engine]!.requests, `${engine}: one model call`).toHaveLength(1);

        if (variant === 'image') {
          expect(state.lastUserParts, `${engine}: image becomes a file part`).toContain('file');
          expect(mediaTypes(lastUser), `${engine}: image media type survives`).toContain('image/png');
        }
        if (variant === 'file') {
          expect(state.lastUserParts, `${engine}: file part reached the model`).toContain('file');
        }
        if (variant === 'multipart') {
          expect(JSON.stringify(lastUser.content), `${engine}: both text parts reached the model`).toContain(
            'part one.',
          );
          expect(JSON.stringify(lastUser.content), `${engine}: both text parts reached the model`).toContain(
            'part two.',
          );
        }
        if (variant === 'context') {
          expect(JSON.stringify(prompt), `${engine}: context message reached the model`).toContain('CONTEXT-T39');
          expect(state.persistedJson, `${engine}: context was not persisted`).not.toContain('CONTEXT-T39');
        }

        expect(state.persistedUserCount, `${engine}: user message persisted once`).toBe(1);
        expect(state.promptRoles, `${engine}: recorded prompt roles`).toEqual(CONTRACT[variant].promptRoles);
        expect(state.lastUserParts, `${engine}: recorded last user parts`).toEqual(CONTRACT[variant].lastUserParts);
        expect(state.persistedShape, `${engine}: recorded persisted messages`).toEqual(
          CONTRACT[variant].persistedShape,
        );
      }
    });
  }
});
