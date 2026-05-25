import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { MockLanguageModelV2 } from './mock-model';

/**
 * Tests for the AGENT_RESUME_NO_SNAPSHOT_FOUND error.
 *
 * These verify that resumeStream / resumeGenerate throw an actionable error
 * when no agentic-loop snapshot can be loaded, rather than the cryptic
 * "No snapshot found for this workflow run: agentic-loop <runId>" from the
 * workflow engine.
 *
 * For the full suspend → resume happy-path tests, see issues:
 *  - https://github.com/mastra-ai/mastra/issues/10389
 *  - https://github.com/mastra-ai/mastra/issues/14663
 */

function createMockModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  });
}

describe('resumeStream / resumeGenerate — no snapshot found', () => {
  describe('resumeStream', () => {
    it('throws AGENT_RESUME_NO_SNAPSHOT_FOUND when no storage is configured', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });

      // No Mastra instance → no storage → no snapshot
      await expect(agent.resumeStream({ approved: true }, { runId: 'some-run-id' })).rejects.toThrow(
        expect.objectContaining({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          message: expect.stringContaining('some-run-id'),
        }),
      );
    });

    it('throws AGENT_RESUME_NO_SNAPSHOT_FOUND when storage exists but runId is unknown', async () => {
      const mockModel = createMockModel();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: mockModel as any,
      });

      const mastra = new Mastra({
        agents: { 'test-agent': agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      const registeredAgent = mastra.getAgent('test-agent');

      await expect(registeredAgent.resumeStream({ approved: true }, { runId: 'does-not-exist' })).rejects.toThrow(
        expect.objectContaining({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          message: expect.stringContaining('does-not-exist'),
        }),
      );
    });

    it('error message mentions missing storage when Mastra has no storage', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });

      const mastra = new Mastra({
        agents: { 'test-agent': agent },
        logger: false,
        // no storage
      });

      const registeredAgent = mastra.getAgent('test-agent');

      await expect(registeredAgent.resumeStream({ approved: true }, { runId: 'abc' })).rejects.toThrow(
        expect.objectContaining({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          message: expect.stringContaining('storage'),
        }),
      );
    });
  });

  describe('resumeStream — snapshot read race', () => {
    it('retries the snapshot read until a suspended snapshot is visible', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });

      const mastra = new Mastra({
        agents: { 'test-agent': agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      const registeredAgent = mastra.getAgent('test-agent');

      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      if (!workflowsStore) throw new Error('workflows store not available');

      const fakeSnapshot = { runId: 'race-run', status: 'suspended' } as any;
      const loadSpy = vi
        .spyOn(workflowsStore, 'loadWorkflowSnapshot')
        .mockImplementationOnce(async () => null)
        .mockImplementationOnce(async () => null)
        .mockImplementation(async () => fakeSnapshot);

      let caught: any;
      try {
        await registeredAgent.resumeStream({ approved: true }, { runId: 'race-run' });
      } catch (err) {
        caught = err;
      }

      expect(loadSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(caught?.id).not.toBe('AGENT_RESUME_NO_SNAPSHOT_FOUND');
    });
  });

  describe('resumeGenerate', () => {
    it('throws AGENT_RESUME_NO_SNAPSHOT_FOUND when no storage is configured', async () => {
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: createMockModel() as any,
      });

      await expect(agent.resumeGenerate({ approved: true }, { runId: 'some-run-id' })).rejects.toThrow(
        expect.objectContaining({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          message: expect.stringContaining('some-run-id'),
        }),
      );
    });

    it('throws AGENT_RESUME_NO_SNAPSHOT_FOUND when storage exists but runId is unknown', async () => {
      const mockModel = createMockModel();
      const agent = new Agent({
        name: 'test-agent',
        instructions: 'test',
        model: mockModel as any,
      });

      const mastra = new Mastra({
        agents: { 'test-agent': agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      const registeredAgent = mastra.getAgent('test-agent');

      await expect(registeredAgent.resumeGenerate({ approved: true }, { runId: 'does-not-exist' })).rejects.toThrow(
        expect.objectContaining({
          id: 'AGENT_RESUME_NO_SNAPSHOT_FOUND',
          message: expect.stringContaining('does-not-exist'),
        }),
      );
    });
  });
});
