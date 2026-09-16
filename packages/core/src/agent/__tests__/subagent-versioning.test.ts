import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IMastraLogger } from '../../logger';
import { Mastra } from '../../mastra';
import type { VersionOverrides } from '../../mastra/types';
import { mergeVersionOverrides } from '../../mastra/types';
import { RequestContext, MASTRA_VERSIONS_KEY } from '../../request-context';
import { Agent } from '../agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn().mockReturnValue(new Map()),
  } as unknown as IMastraLogger & {
    warn: ReturnType<typeof vi.fn>;
    trackException: ReturnType<typeof vi.fn>;
  };
}

function makeMockModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
  });
}

function makeMockModelV1(responseText: string) {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { promptTokens: 5, completionTokens: 10 },
      text: responseText,
    }),
  });
}

function makeSupervisorModel(subAgentKey: string, prompt: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call-1',
              toolName: `agent-${subAgentKey}`,
              input: JSON.stringify({ prompt }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
  });
}

function makeSupervisorModelV1(subAgentKey: string, prompt: string) {
  let callCount = 0;
  return new MockLanguageModelV1({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { promptTokens: 10, completionTokens: 20 },
          text: undefined,
          toolCalls: [
            {
              toolCallType: 'function' as const,
              toolCallId: 'call-1',
              toolName: `agent-${subAgentKey}`,
              args: JSON.stringify({ prompt }),
            },
          ],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Done',
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mergeVersionOverrides', () => {
  it('returns overrides when base is undefined', () => {
    const overrides: VersionOverrides = { agents: { a: { versionId: '1' } } };
    expect(mergeVersionOverrides(undefined, overrides)).toEqual(overrides);
  });

  it('merges agents from base and overrides', () => {
    const base: VersionOverrides = {
      agents: { a: { versionId: '1' }, b: { status: 'published' } },
    };
    const overrides: VersionOverrides = {
      agents: { b: { versionId: '2' }, c: { status: 'draft' } },
    };
    expect(mergeVersionOverrides(base, overrides)).toEqual({
      agents: {
        a: { versionId: '1' },
        b: { versionId: '2' }, // overrides wins
        c: { status: 'draft' },
      },
    });
  });

  it('returns undefined when both base and overrides are undefined', () => {
    expect(mergeVersionOverrides(undefined, undefined)).toBeUndefined();
  });

  it('returns base when overrides is undefined', () => {
    const base: VersionOverrides = { agents: { a: { versionId: '1' } } };
    expect(mergeVersionOverrides(base, undefined)).toEqual(base);
  });

  it('preserves defaultStatus from base when overrides has none', () => {
    const base: VersionOverrides = { agents: { a: { versionId: '1' } }, defaultStatus: 'draft' };
    const overrides: VersionOverrides = { agents: { b: { status: 'published' } } };
    const result = mergeVersionOverrides(base, overrides);
    expect(result?.defaultStatus).toBe('draft');
  });

  it('overrides defaultStatus from overrides', () => {
    const base: VersionOverrides = { defaultStatus: 'draft' };
    const overrides: VersionOverrides = { defaultStatus: 'published' };
    const result = mergeVersionOverrides(base, overrides);
    expect(result?.defaultStatus).toBe('published');
  });
});

describe('Sub-agent version resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('seeds Mastra-level version overrides onto requestContext', async () => {
    const versions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'v42' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    // Spy on resolveVersionedAgent to verify it's called with the correct selector
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', { maxSteps: 3 });

    expect(resolveSpy).toHaveBeenCalledWith(sub, { versionId: 'v42' });
  });

  it('call-site versions override Mastra-level versions', async () => {
    const mastraVersions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'mastra-v1' } } };
    const callSiteVersions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'call-v2' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions: mastraVersions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', {
      maxSteps: 3,
      versions: callSiteVersions,
    });

    // Call-site version should win
    expect(resolveSpy).toHaveBeenCalledWith(sub, { versionId: 'call-v2' });
  });

  it('does not call resolveVersionedAgent when no version override for sub-agent', async () => {
    const versions: VersionOverrides = { agents: { 'other-agent': { versionId: 'v1' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent');

    await supervisor.generate('Do something', { maxSteps: 3 });

    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it('falls back to code-defined agent when version resolution fails', async () => {
    const versions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'nonexistent' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('code-defined response'),
    });

    const generateSpy = vi.spyOn(sub, 'generate');

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    vi.spyOn(mastra, 'resolveVersionedAgent').mockRejectedValue(new Error('Editor not configured'));

    // Should not throw — falls back to default agent
    const result = await supervisor.generate('Do something', { maxSteps: 3 });
    expect(result.text).toBeDefined();

    // Verify the code-defined sub-agent was invoked (fallback)
    expect(generateSpy).toHaveBeenCalled();
  });

  it('uses resolved agent for generation when version override succeeds', async () => {
    const versions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'v99' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('original response'),
    });

    // The "versioned" agent returns different text
    const versionedSub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'versioned sub',
      model: makeMockModel('versioned response'),
    });

    const originalGenerateSpy = vi.spyOn(sub, 'generate');
    const versionedGenerateSpy = vi.spyOn(versionedSub, 'generate');

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(versionedSub);

    await supervisor.generate('Do something', { maxSteps: 3 });

    // The sub-agent should have been resolved with the versioned model
    expect(mastra.resolveVersionedAgent).toHaveBeenCalledWith(sub, { versionId: 'v99' });

    // Verify the versioned agent was invoked, not the original
    expect(versionedGenerateSpy).toHaveBeenCalled();
    expect(originalGenerateSpy).not.toHaveBeenCalled();
  });

  it('uses generateLegacy for v1 sub-agents when parent is called with generateLegacy', async () => {
    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModelV1('legacy sub response'),
    });

    const generateLegacySpy = vi.spyOn(sub, 'generateLegacy');
    const streamLegacySpy = vi.spyOn(sub, 'streamLegacy');

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModelV1('sub', 'hello'),
      agents: { sub },
    });

    new Mastra({
      agents: { supervisor, sub },
    });

    await supervisor.generateLegacy('Do something', { maxSteps: 3 });

    expect(generateLegacySpy).toHaveBeenCalled();
    expect(streamLegacySpy).not.toHaveBeenCalled();
  });

  it('propagates versions through requestContext to sub-agents', async () => {
    const versions: VersionOverrides = { agents: { 'sub-agent': { status: 'draft' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', { maxSteps: 3 });

    expect(resolveSpy).toHaveBeenCalledWith(sub, { status: 'draft' });
  });

  it('uses defaultStatus as fallback when no explicit override exists for sub-agent', async () => {
    const versions: VersionOverrides = { defaultStatus: 'draft' };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', { maxSteps: 3 });

    expect(resolveSpy).toHaveBeenCalledWith(sub, { status: 'draft' });
  });

  it('explicit per-agent override takes precedence over defaultStatus', async () => {
    const versions: VersionOverrides = {
      agents: { 'sub-agent': { versionId: 'v42' } },
      defaultStatus: 'published',
    };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', { maxSteps: 3 });

    // Explicit per-agent override wins over defaultStatus
    expect(resolveSpy).toHaveBeenCalledWith(sub, { versionId: 'v42' });
  });

  it('defaultStatus published resolves sub-agents to published version', async () => {
    const ctx = new RequestContext();
    ctx.set(MASTRA_VERSIONS_KEY, { defaultStatus: 'published' } as VersionOverrides);

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    await supervisor.generate('Do something', { maxSteps: 3, requestContext: ctx });

    expect(resolveSpy).toHaveBeenCalledWith(sub, { status: 'published' });
  });

  it('requestContext with existing versions is not overwritten by Mastra defaults', async () => {
    const mastraVersions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'mastra-default' } } };
    const presetVersions: VersionOverrides = { agents: { 'sub-agent': { versionId: 'preset-ctx' } } };

    const sub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: makeMockModel('sub response'),
    });

    const supervisor = new Agent({
      id: 'supervisor',
      name: 'supervisor',
      instructions: 'You delegate.',
      model: makeSupervisorModel('sub', 'hello'),
      agents: { sub },
    });

    const mastra = new Mastra({
      agents: { supervisor, sub },
      versions: mastraVersions,
    });

    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(sub);

    // Pre-populate requestContext with versions — Mastra defaults should NOT overwrite
    const ctx = new RequestContext();
    ctx.set(MASTRA_VERSIONS_KEY, presetVersions);

    await supervisor.generate('Do something', {
      maxSteps: 3,
      requestContext: ctx,
    });

    // Should use the preset versions, not the Mastra defaults
    expect(resolveSpy).toHaveBeenCalledWith(sub, { versionId: 'preset-ctx' });
  });
});

describe('direct agent call version resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves versioned self when requestContext versions select the agent', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });
    const versionedAgent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'versioned instructions',
      model: makeMockModel('versioned response'),
    });

    const mastra = new Mastra({ agents: { agent } });
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(versionedAgent);

    const ctx = new RequestContext();
    ctx.set(MASTRA_VERSIONS_KEY, { agents: { 'my-agent': { versionId: 'v1' } } } as VersionOverrides);

    const result = await agent.generate('hello', { requestContext: ctx });

    expect(resolveSpy).toHaveBeenCalledWith(agent, { versionId: 'v1' });
    expect(result.text).toBe('versioned response');
  });

  it('resolves versioned self when call-site versions select the agent', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });
    const versionedAgent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'versioned instructions',
      model: makeMockModel('versioned response'),
    });

    const mastra = new Mastra({ agents: { agent } });
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(versionedAgent);

    const result = await agent.generate('hello', {
      versions: { agents: { 'my-agent': { status: 'published' } } },
    });

    expect(resolveSpy).toHaveBeenCalledWith(agent, { status: 'published' });
    expect(result.text).toBe('versioned response');
  });

  it('defaultStatus applies to the called agent itself', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });
    const versionedAgent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'versioned instructions',
      model: makeMockModel('versioned response'),
    });

    const mastra = new Mastra({ agents: { agent }, versions: { defaultStatus: 'published' } });
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(versionedAgent);

    const result = await agent.generate('hello');

    expect(resolveSpy).toHaveBeenCalledWith(agent, { status: 'published' });
    expect(result.text).toBe('versioned response');
  });

  it('does not resolve self when overrides target another agent', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });

    const mastra = new Mastra({ agents: { agent }, versions: { agents: { 'other-agent': { versionId: 'v1' } } } });
    const resolveSpy = vi.spyOn(mastra, 'resolveVersionedAgent');

    const result = await agent.generate('hello');

    expect(resolveSpy).not.toHaveBeenCalled();
    expect(result.text).toBe('code response');
  });

  it('falls back to the code-defined agent when self resolution fails', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });

    const mastra = new Mastra({ agents: { agent }, versions: { agents: { 'my-agent': { versionId: 'v1' } } } });
    vi.spyOn(mastra, 'resolveVersionedAgent').mockRejectedValue(new Error('Editor not configured'));

    const result = await agent.generate('hello');

    expect(result.text).toBe('code response');
  });

  it('does not warn when a stamped defaultStatus meets a project without the editor', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });

    const logger = createMockLogger();
    new Mastra({ agents: { agent }, logger });

    // The server stamps `defaultStatus: 'published'` on every agent request.
    const ctx = new RequestContext();
    ctx.set(MASTRA_VERSIONS_KEY, { defaultStatus: 'published' } as VersionOverrides);

    const result = await agent.generate('hello', { requestContext: ctx });

    expect(result.text).toBe('code response');
    expect(logger.warn.mock.calls.map(([message]) => message)).not.toContain(
      'Failed to resolve versioned agent for direct call, using code-defined default',
    );
    expect(logger.trackException).not.toHaveBeenCalled();
  });

  it('resolves stored overrides exactly once (fork is marked, no recursion)', async () => {
    const agent = new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });

    const applyStoredOverrides = vi.fn(async (a: Agent) => a.__fork());
    const stubEditor = { agent: { applyStoredOverrides } } as any;

    new Mastra({
      agents: { agent },
      versions: { defaultStatus: 'published' },
      editor: stubEditor,
    });

    const result = await agent.generate('hello');

    expect(applyStoredOverrides).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('code response');
  });
});

describe('Mastra#resolveVersionedAgent without the editor', () => {
  const makeAgent = () =>
    new Agent({
      id: 'my-agent',
      name: 'my-agent',
      instructions: 'code instructions',
      model: makeMockModel('code response'),
    });

  it('returns the code-defined agent for a status selector', async () => {
    const agent = makeAgent();
    const mastra = new Mastra({ agents: { agent } });

    await expect(mastra.resolveVersionedAgent(agent, { status: 'published' })).resolves.toBe(agent);
  });

  it('throws for an explicit versionId selector', async () => {
    const agent = makeAgent();
    const mastra = new Mastra({ agents: { agent } });

    await expect(mastra.resolveVersionedAgent(agent, { versionId: 'v1' })).rejects.toMatchObject({
      id: 'MASTRA_EDITOR_REQUIRED_FOR_VERSIONED_AGENT_LOOKUP',
    });
  });
});
