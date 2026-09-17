import { MockLanguageModelV1, simulateReadableStream } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';

function textModel(text: string) {
  const doGenerate = vi.fn(async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop' as const,
    usage: { promptTokens: 5, completionTokens: 10 },
    text,
  }));
  const doStream = vi.fn(async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: 'text-delta' as const, textDelta: text },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          logprobs: undefined,
          usage: { promptTokens: 5, completionTokens: 10 },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }));
  return { model: new MockLanguageModelV1({ doGenerate, doStream }), doGenerate, doStream };
}

function resolvedAgent(id: string, text: string, versionId: string) {
  const model = textModel(text);
  const agent = new Agent({ id, name: id, instructions: id, model: model.model });
  agent.__setRawConfig({ resolvedVersionId: versionId });
  return { agent, ...model };
}

describe('legacy agent version boundary', () => {
  it('resolves a root label before direct generateLegacy behavior', async () => {
    const baseModel = textModel('base');
    const root = new Agent({ id: 'legacy-root', name: 'root', instructions: 'root', model: baseModel.model });
    const selected = resolvedAgent('legacy-root', 'selected-v1', 'root-v1');
    const mastra = new Mastra({ agents: { root } });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(selected.agent);

    const result = await root.generateLegacy('start', {
      versions: { self: { label: 'production' } },
    });

    expect(result.text).toBe('selected-v1');
    expect(resolve).toHaveBeenCalledWith(root, { label: 'production' });
    expect(selected.doGenerate).toHaveBeenCalledOnce();
    expect(baseModel.doGenerate).not.toHaveBeenCalled();
  });

  it('resolves a root label before direct streamLegacy behavior', async () => {
    const baseModel = textModel('base');
    const root = new Agent({ id: 'legacy-stream-root', name: 'root', instructions: 'root', model: baseModel.model });
    const selected = resolvedAgent('legacy-stream-root', 'selected-stream-v1', 'root-v1');
    const mastra = new Mastra({ agents: { root } });
    const resolve = vi.spyOn(mastra, 'resolveVersionedAgent').mockResolvedValue(selected.agent);

    const result = await root.streamLegacy('start', {
      versions: { self: { label: 'production' } },
    });

    await result.consumeStream();
    expect(await result.text).toBe('selected-stream-v1');
    expect(resolve).toHaveBeenCalledWith(root, { label: 'production' });
    expect(selected.doStream).toHaveBeenCalledOnce();
    expect(baseModel.doStream).not.toHaveBeenCalled();
  });

  it('keeps a dependency label pinned when it moves after legacy model behavior starts', async () => {
    let releaseRouting!: () => void;
    const routingReleased = new Promise<void>(resolve => {
      releaseRouting = resolve;
    });
    let reportRoutingStarted!: () => void;
    const routingStarted = new Promise<void>(resolve => {
      reportRoutingStarted = resolve;
    });
    let supervisorCallCount = 0;
    const supervisorModel = new MockLanguageModelV1({
      doGenerate: async () => {
        supervisorCallCount++;
        if (supervisorCallCount === 1) {
          reportRoutingStarted();
          await routingReleased;
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            finishReason: 'tool-calls' as const,
            usage: { promptTokens: 5, completionTokens: 10 },
            text: undefined,
            toolCalls: [
              {
                toolCallType: 'function' as const,
                toolCallId: 'delegate-1',
                toolName: 'agent-sub',
                args: JSON.stringify({ prompt: 'continue' }),
              },
            ],
          };
        }
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop' as const,
          usage: { promptTokens: 5, completionTokens: 10 },
          text: 'done',
        };
      },
    });
    const configuredSub = new Agent({
      id: 'sub-agent',
      name: 'sub',
      instructions: 'sub',
      model: textModel('base-sub').model,
    });
    const subV1 = resolvedAgent('sub-agent', 'sub-v1', 'sub-v1');
    const subV2 = resolvedAgent('sub-agent', 'sub-v2', 'sub-v2');
    const supervisor = new Agent({
      id: 'legacy-supervisor',
      name: 'supervisor',
      instructions: 'delegate',
      model: supervisorModel,
      agents: { sub: configuredSub },
    });
    const mastra = new Mastra({ agents: { supervisor, configuredSub } });
    let labelTarget = 'sub-v1';
    const selectors: unknown[] = [];
    vi.spyOn(mastra, 'resolveVersionedAgent').mockImplementation(async (_agent, selector) => {
      selectors.push(selector);
      const versionId = 'versionId' in selector ? selector.versionId : labelTarget;
      return versionId === 'sub-v1' ? subV1.agent : subV2.agent;
    });

    const run = supervisor.generateLegacy('start', {
      maxSteps: 3,
      versions: { agents: { 'sub-agent': { label: 'production' } } },
    });
    await routingStarted;
    expect(selectors).toContainEqual({ label: 'production' });

    labelTarget = 'sub-v2';
    releaseRouting();
    await expect(run).resolves.toMatchObject({ text: 'done' });

    expect(subV1.doGenerate).toHaveBeenCalledOnce();
    expect(subV2.doGenerate).not.toHaveBeenCalled();
    expect(selectors.filter(selector => 'label' in (selector as Record<string, unknown>))).toEqual([
      { label: 'production' },
    ]);
  });
});
