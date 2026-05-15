import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { Extractor } from '../extractor';
import { Subconscious } from '../subconscious';
import { builtInPsycheDefinitions } from '../subconscious-builtins';

function createModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
  });
}

function createAgent(id = 'agent-1') {
  return new Agent({ id, name: id, instructions: 'Test agent', model: createModel() });
}

function createContext(extractor: Extractor<Record<string, unknown>>) {
  return {
    source: 'observer' as const,
    observations: {
      observedMessages: [],
      activeObservations: 'old observations',
      newObservations: 'new observations',
    },
    extractor,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    mainAgent: createAgent('main-agent'),
    requestContext: new RequestContext(),
    currentModel: { provider: 'test', modelId: 'model' },
    writeObservations: vi.fn(async () => undefined),
  };
}

function streamWithParts(parts: unknown[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part;
    })(),
  } as any;
}

describe('Subconscious', () => {
  it('parses built-in psyche schemas', () => {
    expect(
      builtInPsycheDefinitions.critic.schema.parse({
        risks: ['risky'],
        contradictions: [],
        policyConcerns: [],
        securityConcerns: ['secret exposure'],
        needsReview: true,
      }),
    ).toMatchObject({ needsReview: true, risks: ['risky'] });

    expect(
      builtInPsycheDefinitions.learner.schema.parse({
        skillCandidates: [{ name: 'debug-ci', reason: 'repeated CI failures', evidence: [] }],
        skillUpdates: [],
      }),
    ).toMatchObject({ skillCandidates: [{ name: 'debug-ci', reason: 'repeated CI failures', evidence: [] }] });

    expect(
      builtInPsycheDefinitions.integrator.schema.parse({
        knowledgeDeltas: ['Tyler works on Mastra'],
        entities: [],
        relationships: [],
        staleKnowledge: [],
      }),
    ).toMatchObject({ knowledgeDeltas: ['Tyler works on Mastra'] });
  });

  it('normalizes model-natural built-in psyche output shapes', () => {
    expect(
      builtInPsycheDefinitions.learner.schema.parse({
        skillCandidates: ['research-person-profile'],
        skillUpdates: ['prefer source disambiguation'],
      }),
    ).toMatchObject({
      skillCandidates: [{ name: 'research-person-profile', reason: 'research-person-profile' }],
      skillUpdates: [{ name: 'prefer source disambiguation', change: 'prefer source disambiguation' }],
    });

    expect(
      builtInPsycheDefinitions.integrator.schema.parse({
        knowledgeDeltas: ['Tyler works on Mastra'],
        entities: ['Tyler Barnes'],
        relationships: [{ source: 'Tyler Barnes', target: 'Mastra' }],
        staleKnowledge: [{ note: 'Check similarly named people' }],
      }),
    ).toMatchObject({
      knowledgeDeltas: ['Tyler works on Mastra'],
      entities: [{ name: 'Tyler Barnes', summary: 'Tyler Barnes' }],
      relationships: [{ subject: 'Tyler Barnes', relation: 'related_to', object: 'Mastra' }],
    });
  });

  it('array shorthand creates a stable extractor with active psyche instructions', () => {
    const extractor = new Subconscious({ model: createModel() }).psyches(['critic', 'learner']);

    expect(extractor.slug).toBe('subconscious');
    expect(extractor.instructions).toContain('Property "critic"');
    expect(extractor.instructions).toContain('Property "learner"');
    expect(extractor.schema.parse({ critic: { risks: ['risk'], needsReview: true } })).toMatchObject({
      critic: { risks: ['risk'], needsReview: true },
    });
  });

  it('object form applies schema and instruction overrides', () => {
    const extractor = new Subconscious({ model: createModel() }).psyches({
      active: ['critic'],
      schemas: { critic: z.object({ verdict: z.enum(['ok', 'review']) }) },
      instructions: { critic: 'Output a compact critic verdict.' },
    });

    expect(extractor.instructions).toContain('Output a compact critic verdict.');
    expect(extractor.schema.parse({ critic: { verdict: 'review' } })).toEqual({ critic: { verdict: 'review' } });
  });

  it('onExtracted replaces default routing and receives a scoped runtime', async () => {
    const onExtracted = vi.fn();
    const agent = createAgent('critic-agent');
    const stream = vi.spyOn(agent, 'stream');
    const subconscious = new Subconscious({
      model: createModel(),
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], onExtracted });

    await extractor.onExtracted?.({
      ...createContext(extractor),
      extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
    });

    expect(onExtracted).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: undefined,
        active: ['critic'],
        subconscious: expect.objectContaining({
          source: subconscious,
          active: ['critic'],
          run: expect.any(Function),
          writeObservations: expect.any(Function),
          runAndWriteObservations: expect.any(Function),
        }),
      }),
    );
    expect(stream).not.toHaveBeenCalled();
  });

  it('default routing streams matching psyche agents and writes a workspace activity observation', async () => {
    const agent = createAgent('critic-agent');
    const stream = vi.spyOn(agent, 'stream').mockResolvedValue(
      streamWithParts([
        {
          type: 'tool-result',
          toolName: 'mastra_workspace_write_file',
          result: 'Wrote 6 bytes to review/entity-disambiguation.md',
        },
      ]),
    );
    const subconscious = new Subconscious({ model: createModel(), psyches: { critic: { agent } } });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);

    await extractor.onExtracted?.({
      ...context,
      extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
    });

    expect(stream).toHaveBeenCalledWith(
      expect.stringContaining('Signal: om.subconscious.critic.extracted'),
      expect.objectContaining({
        memory: expect.objectContaining({ resource: 'resource-1', thread: 'subconscious:resource-1:critic' }),
      }),
    );
    expect(stream.mock.calls[0]?.[0]).toContain(JSON.stringify({ risks: ['risk'], needsReview: true }));
    expect(stream.mock.calls[0]?.[0]).toContain('"psyche":"critic"');
    expect(context.writeObservations).toHaveBeenCalledWith([
      expect.stringContaining(
        '<subconscious>\n- critic created/updated review note `review/entity-disambiguation.md`\n</subconscious>',
      ),
    ]);
  });

  it('does not stream a psyche for missing or empty payloads', async () => {
    const agent = createAgent('critic-agent');
    const stream = vi.spyOn(agent, 'stream').mockResolvedValue(streamWithParts([]));
    const subconscious = new Subconscious({ model: createModel(), psyches: { critic: { agent } } });
    const extractor = subconscious.psyches(['critic']);

    await extractor.onExtracted?.({ ...createContext(extractor), extracted: { current: { critic: {} } } });
    await extractor.onExtracted?.({ ...createContext(extractor), extracted: { current: {} } });

    expect(stream).not.toHaveBeenCalled();
  });

  it('supports custom psyches with a supplied agent and schema', () => {
    const agent = createAgent('planner-agent');
    const subconscious = new Subconscious({
      model: createModel(),
      psyches: {
        planner: {
          agent,
          schema: z.object({ next: z.string() }),
          extractionInstructions: 'Extract planning notes.',
        },
      },
    });

    const handle = subconscious.get('planner');
    const extractor = subconscious.psyches(['planner']);

    expect(handle.agent).toBe(agent);
    expect(extractor.schema.parse({ planner: { next: 'ship it' } })).toEqual({ planner: { next: 'ship it' } });
  });
});
