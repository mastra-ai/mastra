import type { Fixtures } from '../__utils__/select-fixture';
import promptSuite from './workflow-builder-prompt-suite.json' with { type: 'json' };

export type CanonicalWorkflowScenarioId =
  | 'addition-workflow'
  | 'customer-ticket-workflow'
  | 'parallel-customer-lookup-workflow'
  | 'support-answer-workflow'
  | 'nested-greeting-workflow'
  | 'foreach-customer-lookup-workflow'
  | 'priority-support-router'
  | 'mixed-support-pipeline';

type OutputAssertion = (output: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCustomer = (value: unknown, email: string) =>
  isRecord(value) && value.customerId === 'customer-123' && value.email === email && value.plan === 'pro';

const isTicket = (value: unknown) => isRecord(value) && value.ticketId === 'ticket-456' && value.status === 'open';

const isNonEmptyString = (value: unknown) => typeof value === 'string' && value.length > 0;

// A conditional branch that was not selected has no step result at all.
const didStepRun = (step: unknown) => isRecord(step) && step.status === 'success';

const scenarioMetadata = {
  'addition-workflow': {
    fixture: 'workflow-builder-prompt-addition',
    expectedGraphEntry: 'add-numbers-result',
    assertOutput: (output: unknown) => isRecord(output) && output.result === 5,
  },
  'customer-ticket-workflow': {
    fixture: 'workflow-builder-prompt-customer-ticket',
    expectedGraphEntry: 'ticket-result',
    assertOutput: (output: unknown) => isTicket(output),
  },
  'parallel-customer-lookup-workflow': {
    fixture: 'workflow-builder-prompt-parallel-customer-lookup',
    expectedGraphEntry: 'parallel-customer-results',
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      isCustomer(output.firstCustomer, 'ada@example.com') &&
      isCustomer(output.secondCustomer, 'grace@example.com'),
  },
  'support-answer-workflow': {
    fixture: 'workflow-builder-prompt-support-answer',
    expectedGraphEntry: 'support-answer-result',
    assertOutput: (output: unknown) => isRecord(output) && isNonEmptyString(output.response),
  },
  'nested-greeting-workflow': {
    fixture: 'workflow-builder-prompt-nested-greeting',
    expectedGraphEntry: 'nested-greeting-result',
    assertOutput: (output: unknown) => isRecord(output) && output.message === 'Hello, Ada!',
  },
  'foreach-customer-lookup-workflow': {
    fixture: 'workflow-builder-prompt-foreach-customer-lookup',
    expectedGraphEntry: 'lookup-customer-item',
    assertOutput: (output: unknown) =>
      Array.isArray(output) && output.length === 1 && isCustomer(output[0], 'ada@example.com'),
  },
  'priority-support-router': {
    fixture: 'workflow-builder-prompt-priority-support-router',
    expectedGraphEntry: 'priority-support-result',
    // The prompt only requires the selected agent text in a `response` field.
    assertOutput: (output: unknown) => isRecord(output) && isNonEmptyString(output.response),
    // Both branches call support-agent, which replies with a fixed string, so
    // the output alone cannot show which branch ran. `runInput` sets an urgent
    // priority, so assert the routing decision directly from step results.
    assertSteps: (steps: unknown) =>
      isRecord(steps) && didStepRun(steps['urgent-support']) && !didStepRun(steps['normal-support']),
  },
  'mixed-support-pipeline': {
    fixture: 'workflow-builder-prompt-mixed-support-pipeline',
    expectedGraphEntry: 'mixed-support-result',
    assertOutput: (output: unknown) => isRecord(output) && isNonEmptyString(output.response) && isTicket(output.ticket),
  },
} satisfies Record<
  CanonicalWorkflowScenarioId,
  { fixture: Fixtures; expectedGraphEntry: string; assertOutput: OutputAssertion; assertSteps?: OutputAssertion }
>;

const isCanonicalScenarioId = (value: string): value is CanonicalWorkflowScenarioId => value in scenarioMetadata;

export const canonicalWorkflowScenarios = promptSuite.scenarios.map(scenario => {
  if (!isCanonicalScenarioId(scenario.id)) {
    throw new Error(`Unknown canonical workflow scenario: ${scenario.id}`);
  }

  const metadata = scenarioMetadata[scenario.id];
  if (metadata.fixture !== scenario.fixture || metadata.expectedGraphEntry !== scenario.expectedGraphEntry) {
    throw new Error(`Canonical workflow metadata drift for ${scenario.id}`);
  }

  return {
    ...scenario,
    id: scenario.id,
    ...metadata,
  };
});

export const getCanonicalWorkflowScenario = (id: CanonicalWorkflowScenarioId) => {
  const scenario = canonicalWorkflowScenarios.find(item => item.id === id);
  if (!scenario) {
    throw new Error(`Missing canonical workflow scenario: ${id}`);
  }
  return scenario;
};
