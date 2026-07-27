export type WorkflowLiveEvalScenario = {
  id: string;
  prompt: string;
  runInput: unknown;
};

export type WorkflowLiveEvalAttempt = {
  scenarioId: string;
  attempt: number;
  lifecycle:
    | 'passed'
    | 'generation'
    | 'checkpoint'
    | 'finalize'
    | 'save'
    | 'reload'
    | 'execution'
    | 'oracle'
    | 'timeout'
    | 'provider'
    | 'infrastructure';
  acceptedRevisionPreserved: boolean;
  persistedDefinitionValid: boolean;
};

export type WorkflowLiveEvalSummary = {
  promptRates: Record<string, number>;
  macroRate: number;
  microRate: number;
  failureCodes: Record<string, number>;
  definitionValidityRate: number;
  acceptedRevisionPreservationRate: number;
};

export const complexWorkflowScenarioIds = new Set([
  'customer-ticket-workflow',
  'parallel-customer-lookup-workflow',
  'priority-support-router',
  'mixed-support-pipeline',
]);

export const createWorkflowLiveEvalPlan = (scenarios: readonly WorkflowLiveEvalScenario[]) =>
  scenarios.flatMap(scenario =>
    Array.from({ length: complexWorkflowScenarioIds.has(scenario.id) ? 20 : 5 }, (_, index) => ({
      scenario,
      attempt: index + 1,
    })),
  );

const passed = (attempt: WorkflowLiveEvalAttempt) =>
  attempt.lifecycle === 'passed' && attempt.acceptedRevisionPreserved && attempt.persistedDefinitionValid;

export const summarizeWorkflowLiveEval = (attempts: readonly WorkflowLiveEvalAttempt[]): WorkflowLiveEvalSummary => {
  const byScenario = new Map<string, WorkflowLiveEvalAttempt[]>();
  const failureCodes: Record<string, number> = {};

  for (const attempt of attempts) {
    const scenarioAttempts = byScenario.get(attempt.scenarioId) ?? [];
    scenarioAttempts.push(attempt);
    byScenario.set(attempt.scenarioId, scenarioAttempts);

    if (!passed(attempt)) {
      failureCodes[attempt.lifecycle] = (failureCodes[attempt.lifecycle] ?? 0) + 1;
    }
  }

  const promptRates = Object.fromEntries(
    [...byScenario].map(([scenarioId, scenarioAttempts]) => [
      scenarioId,
      scenarioAttempts.filter(passed).length / scenarioAttempts.length,
    ]),
  );
  const rates = Object.values(promptRates);

  return {
    promptRates,
    macroRate: rates.length === 0 ? 0 : rates.reduce((total, rate) => total + rate, 0) / rates.length,
    microRate: attempts.length === 0 ? 0 : attempts.filter(passed).length / attempts.length,
    failureCodes,
    definitionValidityRate:
      attempts.length === 0 ? 0 : attempts.filter(attempt => attempt.persistedDefinitionValid).length / attempts.length,
    acceptedRevisionPreservationRate:
      attempts.length === 0
        ? 0
        : attempts.filter(attempt => attempt.acceptedRevisionPreserved).length / attempts.length,
  };
};

export const meetsWorkflowLiveEvalThresholds = (
  summary: WorkflowLiveEvalSummary,
  threshold: number,
  scenarioIds: readonly string[],
) =>
  summary.macroRate >= threshold &&
  summary.definitionValidityRate === 1 &&
  summary.acceptedRevisionPreservationRate === 1 &&
  [...complexWorkflowScenarioIds]
    .filter(id => scenarioIds.includes(id))
    .every(id => (summary.promptRates[id] ?? 0) >= 0.9);

const sensitiveKey = /^(?:api[-_]?key|authorization|password|secret|token)$/i;

export const redactWorkflowLiveEvalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(redactWorkflowLiveEvalValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveKey.test(key) ? '[REDACTED]' : redactWorkflowLiveEvalValue(nestedValue),
      ]),
    );
  }

  return value;
};
