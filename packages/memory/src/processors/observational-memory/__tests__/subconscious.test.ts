import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
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
        skillCandidates: [
          'research-person-profile',
          { name: 'debug-subconscious', evidence: ['psyche agent stopped before workspace writes'] },
        ],
        skillUpdates: ['prefer source disambiguation'],
      }),
    ).toMatchObject({
      skillCandidates: [
        { name: 'research-person-profile', reason: 'research-person-profile' },
        {
          name: 'debug-subconscious',
          reason: 'debug-subconscious',
          evidence: [{ summary: 'psyche agent stopped before workspace writes' }],
        },
      ],
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
          notify: expect.any(Function),
          runAndNotify: expect.any(Function),
        }),
      }),
    );
    expect(stream).not.toHaveBeenCalled();
  });

  it('default routing streams matching psyche agents and signals workspace activity to the main agent', async () => {
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
    const workspacePath = await mkdtemp(join(tmpdir(), 'subconscious-test-'));
    const subconscious = new Subconscious({
      model: createModel(),
      workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath: workspacePath }) }),
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);
    const sendSignal = vi.spyOn(context.mainAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'signal-run',
      signal: {} as any,
    });

    await extractor.onExtracted?.({
      ...context,
      extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
    });

    expect(stream).toHaveBeenCalledWith(
      expect.stringContaining('Signal: om.subconscious.critic.extracted'),
      expect.objectContaining({
        maxSteps: 100,
        memory: expect.objectContaining({ resource: 'resource-1', thread: 'subconscious:resource-1:critic' }),
      }),
    );
    expect(stream.mock.calls[0]?.[0]).toContain(JSON.stringify({ risks: ['risk'], needsReview: true }));
    expect(stream.mock.calls[0]?.[0]).toContain('"psyche":"critic"');
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'om.subconscious.notification',
        contents: expect.stringContaining(
          '<subconscious>\n- critic created/updated review note `review/entity-disambiguation.md`\n</subconscious>',
        ),
      }),
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        ifActive: { behavior: 'deliver' },
        ifIdle: expect.objectContaining({ behavior: 'persist' }),
      }),
    );

    const activityLog = await readFile(join(workspacePath, 'activity/subconscious-log.md'), 'utf-8');
    expect(activityLog).toContain('— observation — critic');
    expect(activityLog).toContain('Thread: `thread-1`');
    expect(activityLog).toContain('Resource: `resource-1`');
    expect(activityLog).toContain('Notification: `sent`');
    expect(activityLog).toContain('### Extractions');
    expect(activityLog).toContain('#### critic');
    expect(activityLog).toContain('"risks": [');
    expect(activityLog).toContain('"needsReview": true');
    expect(activityLog).toContain('### Psyche activity');
    expect(activityLog).toContain('- critic ran psyche agent (1 stream part, 1 workspace operation, maxSteps=100)');
    expect(activityLog).toContain('### Stream parts');
    expect(activityLog).toContain('#### critic part 1 — tool-result — mastra_workspace_write_file');
    expect(activityLog).toContain('"result": "Wrote 6 bytes to review/entity-disambiguation.md"');
    expect(activityLog).toContain('- critic created/updated review note `review/entity-disambiguation.md`');
  });

  it('falls back to read and write when appendFile is unavailable', async () => {
    const agent = createAgent('critic-agent');
    vi.spyOn(agent, 'stream').mockResolvedValue(
      streamWithParts([
        {
          type: 'tool-result',
          toolName: 'mastra_workspace_write_file',
          result: 'Wrote 6 bytes to review/entity-disambiguation.md',
        },
      ]),
    );
    const workspacePath = await mkdtemp(join(tmpdir(), 'subconscious-test-'));
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: workspacePath }) });
    await workspace.filesystem.mkdir('activity', { recursive: true });
    await workspace.filesystem.writeFile('activity/subconscious-log.md', 'existing log\n', { recursive: true });
    vi.spyOn(workspace.filesystem, 'appendFile').mockRejectedValue(new Error('append unsupported'));
    const subconscious = new Subconscious({
      model: createModel(),
      workspace,
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);
    vi.spyOn(context.mainAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'signal-run',
      signal: {} as any,
    });

    await extractor.onExtracted?.({
      ...context,
      extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
    });

    const activityLog = await readFile(join(workspacePath, 'activity/subconscious-log.md'), 'utf-8');
    expect(activityLog).toContain('existing log');
    expect(activityLog).toContain('Notification: `sent`');
    expect(activityLog).toContain('- critic created/updated review note `review/entity-disambiguation.md`');
  });

  it('skips main-agent notification when psyches run without workspace changes', async () => {
    const agent = createAgent('critic-agent');
    vi.spyOn(agent, 'stream').mockResolvedValue(streamWithParts([]));
    const workspacePath = await mkdtemp(join(tmpdir(), 'subconscious-test-'));
    const subconscious = new Subconscious({
      model: createModel(),
      workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath: workspacePath }) }),
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);
    const sendSignal = vi.spyOn(context.mainAgent, 'sendSignal');

    await extractor.onExtracted?.({
      ...context,
      extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
    });

    expect(sendSignal).not.toHaveBeenCalled();
    const activityLog = await readFile(join(workspacePath, 'activity/subconscious-log.md'), 'utf-8');
    expect(activityLog).toContain('Notification: `skipped: notification input produced no non-empty text`');
    expect(activityLog).toContain('#### critic');
    expect(activityLog).toContain('"risks": [');
    expect(activityLog).toContain('"needsReview": true');
    expect(activityLog).toContain('### Psyche activity');
    expect(activityLog).toContain('- critic ran psyche agent (0 stream parts, 0 workspace operations, maxSteps=100)');
    expect(activityLog).toContain('### Stream parts');
    expect(activityLog).toContain('- none');
    expect(activityLog).toContain('- No durable workspace changes detected.');
  });

  it('logs why main-agent notification is skipped when there is no meaningful extraction or workspace activity', async () => {
    const agent = createAgent('critic-agent');
    vi.spyOn(agent, 'stream').mockResolvedValue(streamWithParts([]));
    const workspacePath = await mkdtemp(join(tmpdir(), 'subconscious-test-'));
    const subconscious = new Subconscious({
      model: createModel(),
      workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath: workspacePath }) }),
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);
    const sendSignal = vi.spyOn(context.mainAgent, 'sendSignal');

    await extractor.onExtracted?.({
      ...context,
      extracted: { current: { critic: { risks: [], needsReview: false } } },
    });

    expect(sendSignal).not.toHaveBeenCalled();
    const activityLog = await readFile(join(workspacePath, 'activity/subconscious-log.md'), 'utf-8');
    expect(activityLog).toContain('Notification: `skipped: notification input produced no non-empty text`');
    expect(activityLog).toContain('- critic: no meaningful payload');
    expect(activityLog).toContain('- No durable workspace changes detected.');
  });

  it('does not let activity log failures prevent main-agent notification', async () => {
    const agent = createAgent('critic-agent');
    vi.spyOn(agent, 'stream').mockResolvedValue(
      streamWithParts([
        {
          type: 'tool-result',
          toolName: 'mastra_workspace_write_file',
          result: 'Wrote 6 bytes to review/entity-disambiguation.md',
        },
      ]),
    );
    const workspacePath = await mkdtemp(join(tmpdir(), 'subconscious-test-'));
    const workspace = new Workspace({ filesystem: new LocalFilesystem({ basePath: workspacePath }) });
    vi.spyOn(workspace.filesystem, 'appendFile').mockRejectedValue(new Error('disk full'));
    const subconscious = new Subconscious({
      model: createModel(),
      workspace,
      psyches: { critic: { agent } },
    });
    const extractor = subconscious.psyches({ active: ['critic'], phase: 'observation' });
    const context = createContext(extractor);
    const sendSignal = vi.spyOn(context.mainAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'signal-run',
      signal: {} as any,
    });

    await expect(
      extractor.onExtracted?.({
        ...context,
        extracted: { current: { critic: { risks: ['risk'], needsReview: true } } },
      }),
    ).resolves.toEqual({ critic: { risks: ['risk'], needsReview: true } });

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'om.subconscious.notification' }),
      expect.objectContaining({ ifIdle: expect.objectContaining({ behavior: 'persist' }) }),
    );
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
