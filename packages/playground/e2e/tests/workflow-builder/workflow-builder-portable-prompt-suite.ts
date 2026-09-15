import type { Fixtures } from '../__utils__/select-fixture';
import promptSuite from './workflow-builder-portable-prompt-suite.json' with { type: 'json' };

export type PortableWorkflowScenarioId =
  | 'portable-echo-workflow'
  | 'portable-greeting-workflow'
  | 'portable-order-status-workflow'
  | 'portable-profile-workflow'
  | 'portable-tags-workflow'
  | 'portable-chained-mapping-workflow'
  | 'portable-receipt-workflow'
  | 'portable-defaults-workflow';

type OutputAssertion = (output: unknown) => boolean;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scenarioMetadata = {
  'portable-echo-workflow': {
    fixture: 'workflow-builder-portable-echo',
    expectedGraphEntry: 'echo-message',
    assertOutput: (output: unknown) => isRecord(output) && output.message === 'hello',
  },
  'portable-greeting-workflow': {
    fixture: 'workflow-builder-portable-greeting',
    expectedGraphEntry: 'format-greeting',
    assertOutput: (output: unknown) => isRecord(output) && output.message === 'Hello, Ada!',
  },
  'portable-order-status-workflow': {
    fixture: 'workflow-builder-portable-order-status',
    expectedGraphEntry: 'shape-order-status',
    assertOutput: (output: unknown) =>
      isRecord(output) && output.orderId === 'order-123' && output.status === 'received',
  },
  'portable-profile-workflow': {
    fixture: 'workflow-builder-portable-profile',
    expectedGraphEntry: 'project-profile',
    assertOutput: (output: unknown) => isRecord(output) && output.name === 'Ada' && output.age === 37,
  },
  'portable-tags-workflow': {
    fixture: 'workflow-builder-portable-tags',
    expectedGraphEntry: 'copy-tags',
    assertOutput: (output: unknown) =>
      isRecord(output) && Array.isArray(output.tags) && output.tags.join(',') === 'alpha,beta',
  },
  'portable-chained-mapping-workflow': {
    fixture: 'workflow-builder-portable-chained-mapping',
    expectedGraphEntry: 'copy-normalized-value',
    // Proves the second mapping read the first step's result rather than
    // re-reading workflow input.
    assertOutput: (output: unknown) => isRecord(output) && output.result === 'hello',
  },
  'portable-receipt-workflow': {
    fixture: 'workflow-builder-portable-receipt',
    expectedGraphEntry: 'format-receipt',
    assertOutput: (output: unknown) => isRecord(output) && output.summary === 'Ordered 2 x book',
  },
  'portable-defaults-workflow': {
    fixture: 'workflow-builder-portable-defaults',
    expectedGraphEntry: 'create-defaults',
    assertOutput: (output: unknown) =>
      isRecord(output) && output.enabled === true && output.retries === 3 && output.mode === 'safe',
  },
} satisfies Record<
  PortableWorkflowScenarioId,
  { fixture: Fixtures; expectedGraphEntry: string; assertOutput: OutputAssertion }
>;

const isPortableScenarioId = (value: string): value is PortableWorkflowScenarioId => value in scenarioMetadata;

export const portableWorkflowScenarios = promptSuite.scenarios.map(scenario => {
  if (!isPortableScenarioId(scenario.id)) {
    throw new Error(`Unknown portable workflow scenario: ${scenario.id}`);
  }

  const metadata = scenarioMetadata[scenario.id];
  // Every portable prompt names the mapping it wants, so the live matrix is
  // always allowed to assert the graph shape for these.
  if (
    metadata.fixture !== scenario.fixture ||
    metadata.expectedGraphEntry !== scenario.expectedGraphEntry ||
    scenario.liveGraphPinned !== true
  ) {
    throw new Error(`Portable workflow metadata drift for ${scenario.id}`);
  }

  return { ...scenario, id: scenario.id, ...metadata };
});
