import { describe, expect, it } from 'vitest';
import {
  createWorkflowLiveEvalPlan,
  meetsWorkflowLiveEvalThresholds,
  redactWorkflowLiveEvalValue,
  summarizeWorkflowLiveEval,
} from './workflow-live-eval';
import type { WorkflowLiveEvalAttempt } from './workflow-live-eval';

const scenario = (id: string) => ({ id, prompt: id, runInput: {} });

const passed = (scenarioId: string, attempt: number): WorkflowLiveEvalAttempt => ({
  scenarioId,
  attempt,
  lifecycle: 'passed',
  acceptedRevisionPreserved: true,
  persistedDefinitionValid: true,
});

describe('workflow live evaluation', () => {
  describe('when planning canonical scenarios', () => {
    it('freezes twenty complex attempts and five stable attempts', () => {
      const plan = createWorkflowLiveEvalPlan([scenario('addition-workflow'), scenario('mixed-support-pipeline')]);

      expect(plan).toHaveLength(25);
      expect(plan.filter(item => item.scenario.id === 'addition-workflow')).toHaveLength(5);
      expect(plan.filter(item => item.scenario.id === 'mixed-support-pipeline')).toHaveLength(20);
      expect(plan.at(-1)?.attempt).toBe(20);
    });
  });

  describe('when attempts have unequal sample counts', () => {
    it('reports macro and micro rates independently', () => {
      const attempts = [
        passed('addition-workflow', 1),
        passed('addition-workflow', 2),
        passed('mixed-support-pipeline', 1),
        {
          ...passed('mixed-support-pipeline', 2),
          lifecycle: 'oracle' as const,
        },
      ];

      const summary = summarizeWorkflowLiveEval(attempts);

      expect(summary.promptRates).toEqual({ 'addition-workflow': 1, 'mixed-support-pipeline': 0.5 });
      expect(summary.macroRate).toBe(0.75);
      expect(summary.microRate).toBe(0.75);
      expect(summary.failureCodes).toEqual({ oracle: 1 });
    });
  });

  describe('when a lifecycle succeeds but persistence invariants fail', () => {
    it('counts the attempt as failed and blocks thresholds', () => {
      const attempts = [
        passed('addition-workflow', 1),
        { ...passed('mixed-support-pipeline', 1), acceptedRevisionPreserved: false },
      ];
      const summary = summarizeWorkflowLiveEval(attempts);

      expect(summary.failureCodes).toEqual({ passed: 1 });
      expect(
        meetsWorkflowLiveEvalThresholds(
          summary,
          0.5,
          attempts.map(attempt => attempt.scenarioId),
        ),
      ).toBe(false);
    });
  });

  describe('when evaluation evidence includes credentials', () => {
    it('redacts sensitive keys recursively before recording JSONL', () => {
      expect(
        redactWorkflowLiveEvalValue({
          apiKey: 'secret',
          request: { authorization: 'Bearer secret' },
          maxTokens: '2048',
          output: 'safe',
        }),
      ).toEqual({
        apiKey: '[REDACTED]',
        request: { authorization: '[REDACTED]' },
        maxTokens: '2048',
        output: 'safe',
      });
    });
  });
});
