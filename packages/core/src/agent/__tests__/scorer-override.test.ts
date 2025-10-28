import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { Mastra } from '../../mastra';
import { createScorer } from '../../scores';
import { runScorer } from '../../scores/hooks';
import { getDummyResponseModel } from './mock-model';

function scorerOverrideTest({ version }: { version: 'v1' | 'v2' }) {
  vi.mock('../../scores/hooks', () => ({
    runScorer: vi.fn(),
  }));

  describe('scorer override functionality', () => {
    let agent: Agent;
    let mastra: Mastra;
    let scorerTest: any;
    let scorer1: any;

    const model = getDummyResponseModel(version);

    beforeEach(() => {
      vi.clearAllMocks();
      scorerTest = createScorer({
        name: 'scorerTest',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      scorer1 = createScorer({
        name: 'scorer1',
        description: 'Test Scorer 1',
      }).generateScore(() => 0.95);

      agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent.',
        model,
        scorers: {
          scorerTest: {
            scorer: scorerTest,
          },
        },
      });

      mastra = new Mastra({
        agents: { agent },
        logger: false,
        scorers: { scorer1 },
      });
    });

    it(`${version} - should call scorerTest when no override is provided`, async () => {
      if (version === 'v1') {
        await agent.generateLegacy('Hello world');
      } else {
        await agent.generate('Hello world');
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorerTest',
          scorerObject: expect.objectContaining({
            scorer: scorerTest,
          }),
        }),
      );
    });

    it(`${version} - should use override scorers when provided in generate options`, async () => {
      if (version === 'v1') {
        await agent.generateLegacy('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      } else {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: expect.any(Object),
          }),
        }),
      );

      expect(runScorer).not.toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorerTest',
          scorerObject: expect.objectContaining({
            scorer: scorerTest,
          }),
        }),
      );

      expect(runScorer).toHaveBeenCalledTimes(1);
    });

    it(`${version} - should call scorers when provided in stream options`, async () => {
      let result: any;
      if (version === 'v1') {
        result = await agent.streamLegacy('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      } else {
        result = await agent.stream('Hello world', {
          scorers: {
            scorer1: { scorer: mastra.getScorer('scorer1') },
          },
        });
      }
      await result.consumeStream();

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: expect.any(Object),
          }),
        }),
      );
    });

    it(`${version} - can use scorer name for scorer config for generate`, async () => {
      if (version === 'v1') {
        await agent.generateLegacy('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      } else {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      }

      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer1',
          scorerObject: expect.objectContaining({
            scorer: scorer1,
          }),
        }),
      );
    });

    it(`${version} - should call runScorer with correct parameters`, async () => {
      if (version === 'v1') {
        await agent.generateLegacy('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      } else {
        await agent.generate('Hello world', {
          scorers: {
            scorer1: { scorer: scorer1.name },
          },
        });
      }

      // Verify the exact call parameters
      expect(runScorer).toHaveBeenCalledWith({
        scorerId: 'scorer1',
        scorerObject: { scorer: scorer1 },
        runId: expect.any(String),
        input: expect.any(Object),
        output: expect.any(Object),
        runtimeContext: expect.any(Object),
        entity: expect.objectContaining({
          id: 'test-agent',
          name: 'Test Agent',
        }),
        source: 'LIVE',
        entityType: 'AGENT',
        structuredOutput: false,
        threadId: undefined,
        resourceId: undefined,
        tracingContext: expect.any(Object),
      });
    });
  });
}

scorerOverrideTest({ version: 'v1' });
scorerOverrideTest({ version: 'v2' });
