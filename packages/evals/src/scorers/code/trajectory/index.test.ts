import type { Trajectory, TrajectoryExpectation } from '@mastra/core/evals';
import { describe, expect, test } from 'vitest';
import { createTestMessage, createTrajectoryTestRun } from '../../utils';
import { createTrajectoryAccuracyScorerCode, createTrajectoryScorerCode } from './index';

describe('createTrajectoryAccuracyScorerCode', () => {
  /**
   * Helper to build a Trajectory from step names.
   * Simulates what runEvals produces after extractTrajectory().
   */
  const makeTrajectory = (
    tools: { name: string; toolArgs?: Record<string, unknown>; toolResult?: Record<string, unknown> }[],
  ): Trajectory => ({
    steps: tools.map(t => ({
      stepType: 'tool_call' as const,
      name: t.name,
      toolArgs: t.toolArgs,
      toolResult: t.toolResult,
    })),
  });

  const makeRun = (trajectory: Trajectory, userMessage = 'Do the task') =>
    createTrajectoryTestRun({
      inputMessages: [createTestMessage({ content: userMessage, role: 'user', id: 'input-1' })],
      trajectory,
    });

  const expectedTrajectory: Trajectory = {
    steps: [
      { stepType: 'tool_call', name: 'search' },
      { stepType: 'tool_call', name: 'summarize' },
    ],
  };

  test('should have correct scorer id and name', () => {
    const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });

    expect(scorer.id).toBe('code-trajectory-accuracy-scorer');
    expect(scorer.name).toBe('Trajectory Accuracy Scorer');
  });

  describe('relaxed ordering (default)', () => {
    test('should return 1 when trajectory matches exactly', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search' }, { name: 'summarize' }])));

      expect(result.score).toBe(1);
      expect(result.preprocessStepResult?.comparison.matchedSteps).toBe(2);
      expect(result.preprocessStepResult?.comparison.missingSteps).toEqual([]);
      expect(result.preprocessStepResult?.comparison.extraSteps).toEqual([]);
    });

    test('should return 1 when expected steps are present with extra steps in between', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(
        makeRun(makeTrajectory([{ name: 'search' }, { name: 'validate' }, { name: 'summarize' }])),
      );

      expect(result.score).toBe(1);
      expect(result.preprocessStepResult?.comparison.extraSteps).toEqual(['validate']);
    });

    test('should return 0.5 when only one of two expected steps is found', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search' }])));

      expect(result.score).toBe(0.5);
      expect(result.preprocessStepResult?.comparison.missingSteps).toEqual(['summarize']);
    });

    test('should return 0 when no expected steps are found', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'translate' }, { name: 'format' }])));

      expect(result.score).toBe(0);
      expect(result.preprocessStepResult?.comparison.missingSteps).toEqual(['search', 'summarize']);
    });

    test('should detect out-of-order steps', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'summarize' }, { name: 'search' }])));

      expect(result.score).toBe(0.5);
      expect(result.preprocessStepResult?.comparison.outOfOrderSteps).toContain('summarize');
    });

    test('should allow repeated steps by default', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(
        makeRun(makeTrajectory([{ name: 'search' }, { name: 'search' }, { name: 'summarize' }])),
      );

      expect(result.score).toBe(1);
      expect(result.preprocessStepResult?.comparison.repeatedSteps).toEqual(['search']);
    });

    test('should penalize repeated steps when not allowed', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory,
        comparisonOptions: { allowRepeatedSteps: false },
      });
      const result = await scorer.run(
        makeRun(makeTrajectory([{ name: 'search' }, { name: 'search' }, { name: 'summarize' }])),
      );

      expect(result.score).toBe(0.9);
      expect(result.preprocessStepResult?.comparison.repeatedSteps).toEqual(['search']);
    });
  });

  describe('strict ordering', () => {
    test('should return 1 for exact match', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory,
        comparisonOptions: { ordering: 'strict' },
      });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search' }, { name: 'summarize' }])));

      expect(result.score).toBe(1);
    });

    test('should penalize extra steps with calculated penalty', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory,
        comparisonOptions: { ordering: 'strict' },
      });
      const result = await scorer.run(
        makeRun(makeTrajectory([{ name: 'search' }, { name: 'summarize' }, { name: 'format' }])),
      );

      // 2 matched / 2 expected = 1.0, extra penalty: (1/2) * 0.5 = 0.25, score = 0.75
      expect(result.score).toBe(0.75);
      expect(result.preprocessStepResult?.comparison.extraSteps).toEqual(['format']);
    });

    test('should return 0 when steps are reversed', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory,
        comparisonOptions: { ordering: 'strict' },
      });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'summarize' }, { name: 'search' }])));

      expect(result.score).toBeLessThan(0.5);
    });

    test('should identify missing steps', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory,
        comparisonOptions: { ordering: 'strict' },
      });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search' }])));

      expect(result.score).toBe(0.5);
      expect(result.preprocessStepResult?.comparison.missingSteps).toEqual(['summarize']);
    });
  });

  describe('step data comparison', () => {
    test('should match when step data is identical', async () => {
      // Expected trajectory has toolArgs set → auto-compared
      const expected: Trajectory = {
        steps: [
          { stepType: 'tool_call', name: 'search', toolArgs: { query: 'test' } },
          { stepType: 'tool_call', name: 'summarize', toolArgs: { maxLength: 100 } },
        ],
      };
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory: expected,
      });
      const result = await scorer.run(
        makeRun(
          makeTrajectory([
            { name: 'search', toolArgs: { query: 'test' } },
            { name: 'summarize', toolArgs: { maxLength: 100 } },
          ]),
        ),
      );

      expect(result.score).toBe(1);
    });

    test('should not match when toolArgs data differs', async () => {
      const expected: Trajectory = {
        steps: [{ stepType: 'tool_call', name: 'search', toolArgs: { query: 'test' } }],
      };
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory: expected,
      });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search', toolArgs: { query: 'different' } }])));

      expect(result.score).toBe(0);
    });

    test('should compare toolResult data when present', async () => {
      const expected: Trajectory = {
        steps: [{ stepType: 'tool_call', name: 'search', toolResult: { count: 5 } }],
      };
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory: expected,
      });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search', toolResult: { count: 5 } }])));

      expect(result.score).toBe(1);
    });

    test('should not match when stepType differs', async () => {
      const expected: Trajectory = {
        steps: [{ stepType: 'model_generation', name: 'gpt4' }],
      };
      const scorer = createTrajectoryAccuracyScorerCode({
        expectedTrajectory: expected,
      });
      // actual step has same name but different stepType
      const actual: Trajectory = {
        steps: [{ stepType: 'tool_call', name: 'gpt4' }],
      };
      const result = await scorer.run(makeRun(actual));

      expect(result.score).toBe(0);
    });
  });

  describe('empty trajectories', () => {
    test('should return 0 for empty actual trajectory', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([])));

      expect(result.score).toBe(0);
      expect(result.preprocessStepResult?.comparison.missingSteps).toEqual(['search', 'summarize']);
    });
  });

  describe('preprocess result structure', () => {
    test('should expose both trajectory and comparison details', async () => {
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory });
      const result = await scorer.run(makeRun(makeTrajectory([{ name: 'search' }, { name: 'summarize' }])));

      const pp = result.preprocessStepResult;
      expect(pp).toBeDefined();
      expect(pp?.actualTrajectory.steps).toHaveLength(2);
      expect(pp?.expectedTrajectory).toStrictEqual({
        steps: [
          { name: 'search', stepType: 'tool_call' },
          { name: 'summarize', stepType: 'tool_call' },
        ],
      });
      expect(pp?.actualStepNames).toEqual(['search', 'summarize']);
      expect(pp?.expectedStepNames).toEqual(['search', 'summarize']);
      expect(pp?.comparison).toHaveProperty('score');
      expect(pp?.comparison).toHaveProperty('matchedSteps');
      expect(pp?.comparison).toHaveProperty('missingSteps');
      expect(pp?.comparison).toHaveProperty('extraSteps');
    });
  });

  describe('multiple step types', () => {
    test('should handle mixed step types in trajectory', async () => {
      const expected: Trajectory = {
        steps: [
          { stepType: 'model_generation', name: 'plan' },
          { stepType: 'tool_call', name: 'search' },
          { stepType: 'model_generation', name: 'synthesize' },
        ],
      };
      const scorer = createTrajectoryAccuracyScorerCode({ expectedTrajectory: expected });
      const actual: Trajectory = {
        steps: [
          { stepType: 'model_generation', name: 'plan' },
          { stepType: 'tool_call', name: 'search' },
          { stepType: 'model_generation', name: 'synthesize' },
        ],
      };
      const result = await scorer.run(makeRun(actual));

      expect(result.score).toBe(1);
    });
  });
});

describe('createTrajectoryScorerCode', () => {
  const makeTrajectory = (
    tools: {
      name: string;
      toolArgs?: Record<string, unknown>;
      toolResult?: Record<string, unknown>;
      success?: boolean;
    }[],
  ): Trajectory => ({
    steps: tools.map(t => ({
      stepType: 'tool_call' as const,
      name: t.name,
      toolArgs: t.toolArgs,
      toolResult: t.toolResult,
      success: t.success,
    })),
  });

  const makeRun = (trajectory: Trajectory, expectedTrajectory?: TrajectoryExpectation, userMessage = 'Do the task') =>
    createTrajectoryTestRun({
      inputMessages: [createTestMessage({ content: userMessage, role: 'user', id: 'input-1' })],
      trajectory,
      expectedTrajectory,
    });

  test('should score 1.0 when all dimensions pass', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        steps: [
          { stepType: 'tool_call', name: 'search' },
          { stepType: 'tool_call', name: 'summarize' },
        ],
        maxSteps: 5,
        noRedundantCalls: true,
      },
    });

    const actual = makeTrajectory([
      { name: 'search', success: true },
      { name: 'summarize', success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBe(1);
  });

  test('should hard fail (score 0) when blacklisted tool is used', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        blacklistedTools: ['deleteAll'],
      },
    });

    const actual = makeTrajectory([
      { name: 'search', success: true },
      { name: 'deleteAll', success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBe(0);
  });

  test('should hard fail when blacklisted sequence is found', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        blacklistedSequences: [['escalate', 'admin']],
      },
    });

    const actual = makeTrajectory([
      { name: 'escalate', success: true },
      { name: 'admin', success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBe(0);
  });

  test('should penalize redundant calls', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        noRedundantCalls: true,
      },
    });

    const actual = makeTrajectory([
      { name: 'search', toolArgs: { q: 'test' }, success: true },
      { name: 'search', toolArgs: { q: 'test' }, success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBeLessThan(1);
  });

  test('should penalize when step budget is exceeded', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        maxSteps: 2,
      },
    });

    const actual = makeTrajectory([
      { name: 'a', success: true },
      { name: 'b', success: true },
      { name: 'c', success: true },
      { name: 'd', success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBeLessThan(1);
  });

  test('should use per-item expectedTrajectory to override defaults', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        steps: [
          { stepType: 'tool_call', name: 'search' },
          { stepType: 'tool_call', name: 'summarize' },
        ],
      },
    });

    // Per-item overrides with different expected steps
    const itemExpectation: TrajectoryExpectation = {
      steps: [
        { stepType: 'tool_call', name: 'fetch' },
        { stepType: 'tool_call', name: 'format' },
      ],
    };

    const actual = makeTrajectory([
      { name: 'fetch', success: true },
      { name: 'format', success: true },
    ]);

    const result = await scorer.run(makeRun(actual, itemExpectation));
    // Per-item steps override defaults, so this should match
    expect(result.preprocessStepResult?.accuracy?.score).toBe(1);
  });

  test('should combine multiple dimensions with weights', async () => {
    const scorer = createTrajectoryScorerCode({
      defaults: {
        steps: [{ stepType: 'tool_call', name: 'search' }],
        maxSteps: 1,
        noRedundantCalls: true,
      },
    });

    // Accuracy is perfect, but we have too many steps
    const actual = makeTrajectory([
      { name: 'search', success: true },
      { name: 'extra', success: true },
    ]);

    const result = await scorer.run(makeRun(actual));
    // Should be between 0 and 1 (accuracy is good, efficiency is penalized)
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(1);
  });

  test('should score 1.0 when no expectations are configured', async () => {
    const scorer = createTrajectoryScorerCode();

    const actual = makeTrajectory([{ name: 'search', success: true }]);

    const result = await scorer.run(makeRun(actual));
    expect(result.score).toBe(1);
  });

  test('should support per-item blacklist from dataset', async () => {
    const scorer = createTrajectoryScorerCode();

    const actual = makeTrajectory([
      { name: 'search', success: true },
      { name: 'deleteAll', success: true },
    ]);

    const itemExpectation: TrajectoryExpectation = {
      blacklistedTools: ['deleteAll'],
    };

    const result = await scorer.run(makeRun(actual, itemExpectation));
    expect(result.score).toBe(0);
  });

  describe('ExpectedStep support', () => {
    test('should match ExpectedStep by name only', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }, { name: 'summarize' }],
        },
      });

      const actual = makeTrajectory([{ name: 'search' }, { name: 'summarize' }]);
      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBeGreaterThan(0);
      expect(result.preprocessStepResult?.accuracy?.matchedSteps).toBe(2);
    });

    test('should match ExpectedStep by name + stepType', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search', stepType: 'tool_call' }],
        },
      });

      const actual: Trajectory = {
        steps: [{ stepType: 'model_generation', name: 'search' }],
      };

      const result = await scorer.run(makeRun(actual));
      // stepType mismatch — should not match
      expect(result.preprocessStepResult?.accuracy?.matchedSteps).toBe(0);
    });

    test('should auto-compare ExpectedStep data when fields are present', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          // toolArgs specified → auto-compared
          steps: [{ name: 'search', stepType: 'tool_call', toolArgs: { query: 'hello' } }],
        },
      });

      const actual = makeTrajectory([{ name: 'search', toolArgs: { query: 'hello' } }]);
      const result = await scorer.run(makeRun(actual));
      expect(result.preprocessStepResult?.accuracy?.matchedSteps).toBe(1);
    });

    test('should fail when ExpectedStep data fields do not match', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search', stepType: 'tool_call', toolArgs: { query: 'hello' } }],
        },
      });

      const actual = makeTrajectory([{ name: 'search', toolArgs: { query: 'wrong' } }]);
      const result = await scorer.run(makeRun(actual));
      expect(result.preprocessStepResult?.accuracy?.matchedSteps).toBe(0);
    });
  });

  describe('nested expectation evaluation', () => {
    test('should recursively evaluate children with nested config', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent-run',
              stepType: 'agent_run',
              children: {
                ordering: 'strict',
                steps: [{ name: 'tool-a' }, { name: 'tool-b' }],
              },
            },
          ],
        },
      });

      // Actual trajectory with matching children in correct order
      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent-run',
            agentId: 'agent-1',
            children: [
              { stepType: 'tool_call', name: 'tool-a' },
              { stepType: 'tool_call', name: 'tool-b' },
            ],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBeGreaterThan(0);
      expect(result.preprocessStepResult?.nested).toBeDefined();
      expect(result.preprocessStepResult?.nested).toHaveLength(1);
      expect(result.preprocessStepResult?.nested?.[0]?.stepName).toBe('agent-run');
      expect(result.preprocessStepResult?.nested?.[0]?.accuracy?.matchedSteps).toBe(2);
    });

    test('should score nested children with different ordering than parent', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          ordering: 'strict',
          steps: [
            {
              name: 'orchestrator',
              stepType: 'agent_run',
              children: {
                ordering: 'unordered',
                steps: [{ name: 'fetch' }, { name: 'validate' }],
              },
            },
          ],
        },
      });

      // Parent step matches, children are out of order but allowed (unordered)
      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'orchestrator',
            children: [
              { stepType: 'tool_call', name: 'validate' },
              { stepType: 'tool_call', name: 'fetch' },
            ],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBeGreaterThan(0);
      const nested = result.preprocessStepResult?.nested?.[0];
      expect(nested?.accuracy?.matchedSteps).toBe(2);
    });

    test('should report missing children in nested evaluation', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent-run',
              children: {
                steps: [{ name: 'tool-a' }, { name: 'tool-b' }, { name: 'tool-c' }],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent-run',
            children: [{ stepType: 'tool_call', name: 'tool-a' }],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      const nested = result.preprocessStepResult?.nested?.[0];
      expect(nested?.accuracy?.missingSteps).toContain('tool-b');
      expect(nested?.accuracy?.missingSteps).toContain('tool-c');
    });

    test('should evaluate nested blacklist independently', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent-run',
              children: {
                blacklistedTools: ['dangerous-tool'],
                steps: [{ name: 'safe-tool' }],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent-run',
            children: [
              { stepType: 'tool_call', name: 'safe-tool' },
              { stepType: 'tool_call', name: 'dangerous-tool' },
            ],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      const nested = result.preprocessStepResult?.nested?.[0];
      expect(nested?.blacklist?.score).toBe(0);
    });

    test('should handle 3 levels of nesting', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'workflow',
              stepType: 'workflow_run',
              children: {
                steps: [
                  {
                    name: 'sub-agent',
                    stepType: 'agent_run',
                    children: {
                      steps: [{ name: 'deep-tool' }],
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'workflow_run',
            name: 'workflow',
            children: [
              {
                stepType: 'agent_run',
                name: 'sub-agent',
                children: [{ stepType: 'tool_call', name: 'deep-tool' }],
              },
            ],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBeGreaterThan(0);
      // First level nested result
      const level1 = result.preprocessStepResult?.nested?.[0];
      expect(level1?.stepName).toBe('workflow');
      // Second level nested result (nested within the first level)
      expect(level1?.nested).toBeDefined();
      expect(level1?.nested).toHaveLength(1);
      expect(level1?.nested?.[0]?.stepName).toBe('sub-agent');
      expect(level1?.nested?.[0]?.accuracy?.matchedSteps).toBe(1);
    });

    test('should hard-fail when nested blacklist is violated', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                blacklistedTools: ['forbidden-tool'],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent',
            children: [
              { stepType: 'tool_call', name: 'allowed-tool' },
              { stepType: 'tool_call', name: 'forbidden-tool' },
            ],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBe(0);
    });

    test('should evaluate nested config without steps (blacklist only)', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                blacklistedTools: ['bad-tool'],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent',
            children: [{ stepType: 'tool_call', name: 'good-tool' }],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      // No blacklist violation, should pass
      expect(result.score).toBeGreaterThan(0);
    });

    test('should not bind nested scoring to first duplicate step', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                steps: [{ name: 'tool-a' }],
              },
            },
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                steps: [{ name: 'tool-b' }],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent',
            children: [{ stepType: 'tool_call', name: 'tool-a' }],
          },
          {
            stepType: 'agent_run',
            name: 'agent',
            children: [{ stepType: 'tool_call', name: 'tool-b' }],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      const nested = result.preprocessStepResult?.nested;
      expect(nested).toHaveLength(2);
      // First expected step matches first actual step
      expect(nested?.[0]?.accuracy?.matchedSteps).toBe(1);
      // Second expected step matches second actual step (not first)
      expect(nested?.[1]?.accuracy?.matchedSteps).toBe(1);
    });
  });

  describe('reason generation', () => {
    test('should include accuracy details in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            { stepType: 'tool_call', name: 'search' },
            { stepType: 'tool_call', name: 'summarize' },
          ],
          maxSteps: 5,
          noRedundantCalls: true,
        },
      });

      const actual = makeTrajectory([
        { name: 'search', success: true },
        { name: 'summarize', success: true },
      ]);

      const result = await scorer.run(makeRun(actual));
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Score:');
      expect(result.reason).toContain('Accuracy');
      expect(result.reason).toContain('2/2 expected steps matched');
      expect(result.reason).toContain('Efficiency');
    });

    test('should report missing steps in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            { stepType: 'tool_call', name: 'search' },
            { stepType: 'tool_call', name: 'summarize' },
          ],
        },
      });

      const actual = makeTrajectory([{ name: 'search', success: true }]);

      const result = await scorer.run(makeRun(actual));
      expect(result.reason).toContain('missing: summarize');
    });

    test('should report blacklist violation in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          blacklistedTools: ['deleteAll'],
        },
      });

      const actual = makeTrajectory([{ name: 'deleteAll', success: true }]);

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBe(0);
      expect(result.reason).toContain('Blacklist violation');
      expect(result.reason).toContain('deleteAll');
    });

    test('should report efficiency issues in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          maxSteps: 2,
          noRedundantCalls: true,
        },
      });

      const actual = makeTrajectory([
        { name: 'search', success: true },
        { name: 'search', success: true },
        { name: 'summarize', success: true },
      ]);

      const result = await scorer.run(makeRun(actual));
      expect(result.reason).toContain('Efficiency');
      expect(result.reason).toContain('over step budget');
      expect(result.reason).toContain('redundant calls: search');
    });

    test('should report tool failure details in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          maxRetriesPerTool: 1,
        },
      });

      const actual = makeTrajectory([
        { name: 'search', success: false },
        { name: 'search', success: false },
        { name: 'search', success: true },
      ]);

      const result = await scorer.run(makeRun(actual));
      expect(result.reason).toContain('Tool failures');
      expect(result.reason).toContain('retries');
    });

    test('should report nested scores in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                steps: [{ name: 'inner-tool', stepType: 'tool_call' }],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent',
            agentId: 'agent-1',
            children: [{ stepType: 'tool_call', name: 'inner-tool' }],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.reason).toContain('Nested scores');
      expect(result.reason).toContain('agent');
    });

    test('should report nested blacklist violation in reason', async () => {
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [
            {
              name: 'agent',
              stepType: 'agent_run',
              children: {
                blacklistedTools: ['forbidden'],
              },
            },
          ],
        },
      });

      const actual: Trajectory = {
        steps: [
          {
            stepType: 'agent_run',
            name: 'agent',
            agentId: 'agent-1',
            children: [{ stepType: 'tool_call', name: 'forbidden' }],
          },
        ],
      };

      const result = await scorer.run(makeRun(actual));
      expect(result.score).toBe(0);
      expect(result.reason).toContain('Nested blacklist violation');
      expect(result.reason).toContain('agent');
    });
  });

  describe('configurable weights', () => {
    test('should use custom weights for scoring', async () => {
      // Create two scorers with opposite weights to verify they produce different scores
      const accuracyHeavy = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }, { name: 'summarize' }],
          maxSteps: 1, // over budget → efficiency penalty
        },
        weights: { accuracy: 0.9, efficiency: 0.1, toolFailures: 0, blacklist: 0 },
      });

      const efficiencyHeavy = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }, { name: 'summarize' }],
          maxSteps: 1, // over budget → efficiency penalty
        },
        weights: { accuracy: 0.1, efficiency: 0.9, toolFailures: 0, blacklist: 0 },
      });

      // 2 steps, both matched (accuracy = 1.0), but over maxSteps of 1 (efficiency < 1.0)
      const actual = makeTrajectory([
        { name: 'search', success: true },
        { name: 'summarize', success: true },
      ]);

      const accuracyResult = await accuracyHeavy.run(makeRun(actual));
      const efficiencyResult = await efficiencyHeavy.run(makeRun(actual));

      // Accuracy-heavy should score higher since accuracy is perfect
      expect(accuracyResult.score).toBeGreaterThan(efficiencyResult.score);
    });

    test('should use default weights when not specified', async () => {
      const withDefaults = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }],
          maxSteps: 5,
        },
      });

      const withExplicitDefaults = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }],
          maxSteps: 5,
        },
        weights: { accuracy: 0.4, efficiency: 0.3, toolFailures: 0.2, blacklist: 0.1 },
      });

      const actual = makeTrajectory([{ name: 'search', success: true }]);
      const run = makeRun(actual);

      const defaultResult = await withDefaults.run(run);
      const explicitResult = await withExplicitDefaults.run(run);

      expect(defaultResult.score).toBe(explicitResult.score);
    });

    test('should allow zeroing out a dimension', async () => {
      // Zero out accuracy weight — missing steps should not affect score
      const scorer = createTrajectoryScorerCode({
        defaults: {
          steps: [{ name: 'search' }, { name: 'summarize' }],
          maxSteps: 5,
        },
        weights: { accuracy: 0, efficiency: 1, toolFailures: 0, blacklist: 0 },
      });

      // Only 1 of 2 expected steps — accuracy is low, but weight is 0
      const actual = makeTrajectory([{ name: 'search', success: true }]);
      const result = await scorer.run(makeRun(actual));

      // Score should be based entirely on efficiency (1 step, max 5 = good)
      expect(result.score).toBe(1);
    });
  });
});
