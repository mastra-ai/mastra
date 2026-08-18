/**
 * PROOF RUN (Phase 5) — not a regression test. Drives a real Agent through
 * multiple turns against a real LibSQL store with pins enabled, capturing
 * every prompt the model receives. Output is written to stdout for the
 * .proof/ transcript. Delete or keep: it exercises the same lane either way.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory, Subconscious } from '@mastra/memory';
import type { EmbeddingModel } from 'ai';
import { afterAll, describe, expect, it } from 'vitest';

import { createPinnedTools } from '../../src/processors/observational-memory/subconscious/pinned';

const embedder: EmbeddingModel<string> = {
  specificationVersion: 'v1',
  provider: 'aimock',
  modelId: 'deterministic-embedding',
  maxEmbeddingsPerCall: 128,
  supportsParallelCalls: true,
  async doEmbed({ values }) {
    return { embeddings: values.map(() => [0.1, 0.2, 0.3, 0.4]) };
  },
};

function textStream(text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: randomUUID(), modelId: 'aimock', timestamp: new Date() },
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: text },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
  ] as any[]);
}

describe('Pinned knowledge live proof', () => {
  const directories: string[] = [];
  afterAll(async () => {
    await Promise.all(directories.splice(0).map(d => rm(d, { recursive: true, force: true })));
  });

  it('carries pins into real agent turns: snapshot, delta on edit, clear on unpin', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'pinned-proof-'));
    directories.push(directory);
    const url = `file:${join(directory, 'proof.db')}`;
    const storage = new LibSQLStore({ id: randomUUID(), url });
    const vector = new LibSQLVector({ id: randomUUID(), url });
    await storage.init();

    const prompts: string[] = [];
    const model = new MockLanguageModelV2({
      doGenerate: async (options: any) => {
        prompts.push(JSON.stringify(options.prompt));
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          content: [{ type: 'text' as const, text: 'Understood.' }],
          warnings: [],
        };
      },
      doStream: async (options: any) => {
        prompts.push(JSON.stringify(options.prompt));
        return { stream: textStream('Understood.') };
      },
    });

    const memory = new Memory({
      storage,
      vector,
      embedder,
      options: {
        lastMessages: 20,
        observationalMemory: {
          model,
          experimental_subconscious: new Subconscious({ pins: true }),
        },
      },
    });

    const agent = new Agent({
      id: 'proof-agent',
      name: 'Proof Agent',
      instructions: 'Help the user.',
      model,
      memory,
    });

    const threadId = randomUUID();
    const resourceId = 'proof-user';
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'acme');
    const turnOptions = { memory: { thread: threadId, resource: resourceId }, requestContext } as any;

    const scope = [`org:acme`, `resource:${resourceId}`, `thread:${threadId}`];
    const tools = createPinnedTools({ storage } as any, {
      scope,
      sourceThreadId: threadId,
      defaultScope: 'resource',
      maxPins: 20,
      maxCharacters: 2_000,
    });

    // Turn 1: no pins yet — no pinned-knowledge tag in the prompt.
    await agent.generate('Hello there.', turnOptions);
    expect(prompts.at(-1)).not.toContain('<pinned-knowledge count=');
    console.info('[proof] turn 1: no pins, no pinned-knowledge tag — OK');

    // Curator pins a standing instruction.
    const pin = await tools.knowledge_pin!.execute!({ text: 'Always answer in French.' } as any, {} as any);

    // Turn 2: snapshot appears.
    await agent.generate('What is the capital of France?', turnOptions);
    expect(prompts.at(-1)).toContain('pinned-knowledge count=');
    expect(prompts.at(-1)).toContain('Always answer in French.');
    console.info('[proof] turn 2: snapshot present with pin body — OK');

    // Turn 3: unchanged set — no new signal content beyond the existing snapshot.
    const before = (prompts.at(-1)!.match(/pinned-knowledge/g) ?? []).length;
    await agent.generate('And of Germany?', turnOptions);
    const after = (prompts.at(-1)!.match(/pinned-knowledge/g) ?? []).length;
    expect(after).toBeLessThanOrEqual(before + 1); // snapshot persists, no pile-up of new snapshots
    console.info(`[proof] turn 3: unchanged set, tag occurrences ${before} -> ${after} — OK`);

    // Curator edits the pin.
    const edited = await tools.knowledge_edit_pin!.execute!(
      { recordId: pin.id, text: 'Always answer in French. Politely.' } as any,
      {} as any,
    );

    // Turn 4: the change arrives (delta while the snapshot is visible).
    await agent.generate('Thanks.', turnOptions);
    expect(prompts.at(-1)).toContain('Politely.');
    console.info('[proof] turn 4: edit delivered — OK');

    // Curator unpins.
    await tools.knowledge_unpin!.execute!({ recordId: edited.id } as any, {} as any);

    // Turn 5: lane clears — the latest state carries no pin body.
    await agent.generate('One more thing.', turnOptions);
    const finalPrompt = prompts.at(-1)!;
    const lastIdx = finalPrompt.lastIndexOf('pinned-knowledge');
    // The most recent pinned-knowledge signal must not carry the old text after it.
    expect(finalPrompt.slice(lastIdx)).not.toContain('Politely.');
    console.info('[proof] turn 5: lane cleared after unpin — OK');
  }, 120_000);
});
