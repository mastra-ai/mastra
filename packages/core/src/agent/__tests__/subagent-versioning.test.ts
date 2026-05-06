import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import type { VersionOverrides } from '../../mastra/types';
import { mergeVersionOverrides } from '../../mastra/types';
import { RequestContext, MASTRA_VERSIONS_KEY } from '../../request-context';
import { Agent } from '../agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
