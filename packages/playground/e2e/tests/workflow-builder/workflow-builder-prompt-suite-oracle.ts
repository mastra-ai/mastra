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

const hasOrderedSupportSteps = (value: unknown) =>
  Array.isArray(value) && value.length > 0 && value.every(step => typeof step === 'string' && step.length > 0);

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
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      typeof output.response === 'string' &&
      output.response.length > 0 &&
      hasOrderedSupportSteps(output.steps),
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
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      output.branch === 'urgent' &&
      typeof output.response === 'string' &&
      output.response.length > 0,
  },
  'mixed-support-pipeline': {
    fixture: 'workflow-builder-prompt-mixed-support-pipeline',
    expectedGraphEntry: 'mixed-support-result',
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      typeof output.agentText === 'string' &&
      output.agentText.length > 0 &&
      isTicket(output.ticket),
  },
} satisfies Record<
  CanonicalWorkflowScenarioId,
  { fixture: Fixtures; expectedGraphEntry: string; assertOutput: OutputAssertion }
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
