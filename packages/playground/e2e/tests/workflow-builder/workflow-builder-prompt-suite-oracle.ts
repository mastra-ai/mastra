import type { Fixtures } from '../__utils__/select-fixture';
import promptSuite from './workflow-builder-prompt-suite.json' with { type: 'json' };

export type CanonicalWorkflowScenarioId =
  | 'addition-workflow'
  | 'customer-ticket-workflow'
  | 'parallel-customer-lookup-workflow'
  | 'parallel-support-fanout-workflow'
  | 'support-answer-workflow'
  | 'nested-greeting-workflow'
  | 'foreach-customer-lookup-workflow'
  | 'topic-subtopics-blurbs'
  | 'priority-support-router'
  | 'priority-support-router-normal-route'
  | 'mixed-support-pipeline'
  | 'strict-support-answer-workflow'
  | 'strict-support-ticket-workflow'
  | 'topic-subtopics-blurbs-single-agent';

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
  'parallel-support-fanout-workflow': {
    fixture: 'workflow-builder-prompt-parallel-support-fanout',
    expectedGraphEntry: 'parallel-fanout-result',
    // `runInput` carries customer-999 while lookup-customer always answers with
    // customer-123, so a passing assertion proves the tool actually ran instead
    // of the input being echoed through.
    assertOutput: (output: unknown) =>
      isRecord(output) && isCustomer(output.customer, 'ada@example.com') && isTicket(output.ticket),
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
  'topic-subtopics-blurbs': {
    fixture: 'workflow-builder-prompt-topic-subtopics-blurbs',
    // The inner foreach step id renders in the graph.
    expectedGraphEntry: 'write-blurb',
    // Three non-empty blurbs prove the foreach actually iterated the bridge
    // agent's raw array once per element rather than collapsing it.
    assertOutput: (output: unknown) =>
      Array.isArray(output) &&
      output.length === 3 &&
      output.every(item => isRecord(item) && isNonEmptyString(item.text)),
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
  // Same definition and same fixed agent reply as the urgent route; only the
  // run input differs. Asserting the mirrored branch is what proves the
  // non-urgent predicate is evaluated rather than branch 0 always winning.
  'priority-support-router-normal-route': {
    fixture: 'workflow-builder-prompt-priority-support-router-normal-route',
    expectedGraphEntry: 'priority-support-result',
    assertOutput: (output: unknown) => isRecord(output) && isNonEmptyString(output.response),
    assertSteps: (steps: unknown) =>
      isRecord(steps) && didStepRun(steps['normal-support']) && !didStepRun(steps['urgent-support']),
  },
  'mixed-support-pipeline': {
    fixture: 'workflow-builder-prompt-mixed-support-pipeline',
    expectedGraphEntry: 'mixed-support-result',
    assertOutput: (output: unknown) => isRecord(output) && isNonEmptyString(output.response) && isTicket(output.ticket),
  },
  'strict-support-answer-workflow': {
    fixture: 'workflow-builder-prompt-strict-support-answer',
    expectedGraphEntry: 'strict-support-answer-result',
    liveGraphPinned: false,
    // A closed output schema rejects extra keys, so a successful run is itself
    // the evidence that the mapping produced exactly `response`.
    assertOutput: (output: unknown) =>
      isRecord(output) && isNonEmptyString(output.response) && Object.keys(output).length === 1,
  },
  'strict-support-ticket-workflow': {
    fixture: 'workflow-builder-prompt-strict-support-ticket',
    expectedGraphEntry: 'strict-support-ticket-result',
    liveGraphPinned: false,
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      isNonEmptyString(output.agentText) &&
      isTicket(output.ticket) &&
      Object.keys(output).length === 2,
  },
  'topic-subtopics-blurbs-single-agent': {
    fixture: 'workflow-builder-prompt-topic-subtopics-blurbs-single-agent',
    expectedGraphEntry: 'topic-blurbs-result',
    liveGraphPinned: false,
    // Three complete pairs prove the whole array step result was referenced
    // (`path: ''`) rather than collapsed to a single item.
    assertOutput: (output: unknown) =>
      isRecord(output) &&
      output.topic === 'renewable energy' &&
      Array.isArray(output.items) &&
      output.items.length === 3 &&
      output.items.every(item => isRecord(item) && isNonEmptyString(item.subtopic) && isNonEmptyString(item.blurb)),
  },
} satisfies Record<
  CanonicalWorkflowScenarioId,
  {
    fixture: Fixtures;
    expectedGraphEntry: string;
    // Whether the live matrix may assert this graph shape against the real
    // model. Only true when the prompt itself directs the mechanism; scenarios
    // that constrain schemas (or nothing) leave the model free to choose.
    liveGraphPinned?: boolean;
    assertOutput: OutputAssertion;
    assertSteps?: OutputAssertion;
  }
>;

const isCanonicalScenarioId = (value: string): value is CanonicalWorkflowScenarioId => value in scenarioMetadata;

export const canonicalWorkflowScenarios = promptSuite.scenarios.map(scenario => {
  if (!isCanonicalScenarioId(scenario.id)) {
    throw new Error(`Unknown canonical workflow scenario: ${scenario.id}`);
  }

  const metadata = scenarioMetadata[scenario.id];
  const liveGraphPinned = 'liveGraphPinned' in metadata ? metadata.liveGraphPinned : true;
  if (
    metadata.fixture !== scenario.fixture ||
    metadata.expectedGraphEntry !== scenario.expectedGraphEntry ||
    liveGraphPinned !== scenario.liveGraphPinned
  ) {
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
