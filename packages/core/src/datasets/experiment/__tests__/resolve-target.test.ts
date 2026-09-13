import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../../agent';
import { Mastra } from '../../../mastra';
import { resolveTarget } from '../resolve-target';
import { scriptedModel } from './scenarios/scenario-helpers';

function buildMastra() {
  const agent = new Agent({
    id: 'a',
    name: 'Agent A',
    instructions: 'test',
    model: scriptedModel([{ text: 'A' }], 'model-a'),
  });
  const mastra = new Mastra({ agents: { a: agent }, logger: false });
  return { mastra, agent };
}

describe('resolveTarget', () => {
  describe('without a model override', () => {
    it('returns the registered singleton agent as-is', async () => {
      const { mastra, agent } = buildMastra();

      const resolved = await resolveTarget(mastra, 'agent', 'a');

      expect(resolved?.target).toBe(agent);
    });
  });

  describe('with a model override on an agent target', () => {
    it('returns a fork with the same id whose model is the override', async () => {
      const { mastra, agent } = buildMastra();
      const modelB = scriptedModel([{ text: 'B' }], 'model-b');

      const resolved = await resolveTarget(mastra, 'agent', 'a', undefined, modelB);
      const target = resolved!.target as Agent;

      expect(target).not.toBe(agent);
      expect(target.id).toBe('a');
      expect((await target.getModel()).modelId).toBe('model-b');
    });

    it('leaves the registered singleton agent untouched', async () => {
      const { mastra, agent } = buildMastra();
      const modelB = scriptedModel([{ text: 'B' }], 'model-b');

      await resolveTarget(mastra, 'agent', 'a', undefined, modelB);

      expect((await agent.getModel()).modelId).toBe('model-a');
      expect((await mastra.getAgent('a').getModel()).modelId).toBe('model-a');
    });

    it('applies the override directly on the versioned fork without forking again', async () => {
      const { mastra } = buildMastra();
      const modelB = scriptedModel([{ text: 'B' }], 'model-b');
      const versionedFork = {
        id: 'a',
        __fork: vi.fn(),
        __updateModel: vi.fn(),
      };
      vi.spyOn(mastra, 'getAgentById').mockResolvedValue(versionedFork as never);

      const resolved = await resolveTarget(mastra, 'agent', 'a', 'version-1', modelB);

      expect(mastra.getAgentById).toHaveBeenCalledWith('a', { versionId: 'version-1' });
      expect(versionedFork.__fork).not.toHaveBeenCalled();
      expect(versionedFork.__updateModel).toHaveBeenCalledWith({ model: modelB });
      expect(resolved?.target).toBe(versionedFork);
    });
  });

  describe('with a model override on a non-agent target', () => {
    it('throws instead of silently ignoring the override', async () => {
      const { mastra } = buildMastra();
      const modelB = scriptedModel([{ text: 'B' }], 'model-b');

      await expect(resolveTarget(mastra, 'workflow', 'w', undefined, modelB)).rejects.toThrow(
        'Experiment "model" override is only supported for agent targets (got "workflow")',
      );
    });
  });
});
