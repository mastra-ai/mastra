import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScorer } from '../../evals';
import { runScorer } from '../../evals/hooks';
import { Mastra } from '../../mastra';
import { Agent } from '../agent';
import { getDummyResponseModel } from './mock-model';

vi.mock('../../evals/hooks', () => ({
  runScorer: vi.fn(),
}));

function scorersTests(version: 'v1' | 'v2') {
  const dummyModel = getDummyResponseModel(version);

  describe('scorer output data', () => {
    it(`${version} - should return scoring data from generate when returnScorerData is true`, async () => {
      const agent = new Agent({
        id: 'scorer-test',
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generateLegacy('Make it green', {
          returnScorerData: true,
        });
      } else {
        result = await agent.generate('Make it green', {
          returnScorerData: true,
        });
      }

      expect(result.scoringData).toBeDefined();
      expect(result.scoringData.input).toMatchObject({
        inputMessages: expect.any(Array),
        rememberedMessages: expect.any(Array),
        systemMessages: expect.any(Array),
        taggedSystemMessages: expect.any(Object),
      });
      expect(result.scoringData.output).toBeInstanceOf(Array);
    });

    it(`${version} - should not return scoring data from generate when returnScorerData is false`, async () => {
      const agent = new Agent({
        id: 'scorer-test',
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generateLegacy('Make it green', {
          returnScorerData: false,
        });
      } else {
        result = await agent.generate('Make it green', {
          returnScorerData: false,
        });
      }

      expect(result.scoringData).toBeUndefined();
    });

    it(`${version} - should not return scoring data from generate when returnScorerData is not specified`, async () => {
      const agent = new Agent({
        id: 'scorer-test',
        name: 'Scorer Agent',
        instructions: 'You are an agent that can score things',
        model: dummyModel,
      });

      let result;
      if (version === 'v1') {
        result = await agent.generateLegacy('Make it green');
      } else {
        result = await agent.generate('Make it green');
      }

      expect(result.scoringData).toBeUndefined();
    });
  });

  describe('scorer override functionality', () => {
    let agent: Agent;
    let mastra: Mastra;
    let scorerTest: any;
    let scorer1: any;

    beforeEach(() => {
      vi.clearAllMocks();
      scorerTest = createScorer({
        id: 'scorer-test',
        name: 'scorerTest',
        description: 'Test Scorer',
      }).generateScore(() => 0.95);

      scorer1 = createScorer({
        id: 'scorer-1',
        name: 'scorer1',
        description: 'Test Scorer 1',
      }).generateScore(() => 0.95);

      agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'You are a test agent.',
        model: dummyModel,
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
          scorerId: 'scorer-test',
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
          scorerId: 'scorer-1',
          scorerObject: expect.objectContaining({
            scorer: expect.any(Object),
          }),
        }),
      );

      expect(runScorer).not.toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer-test',
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
          scorerId: 'scorer-1',
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
          scorerId: 'scorer-1',
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
      expect(runScorer).toHaveBeenCalledWith(
        expect.objectContaining({
          scorerId: 'scorer-1',
          scorerObject: expect.objectContaining({
            scorer: scorer1,
          }),
          runId: expect.any(String),
          input: expect.any(Object),
          output: expect.any(Object),
          requestContext: expect.any(Object),
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
        }),
      );
    });
  });
}

scorersTests('v1');
scorersTests('v2');
