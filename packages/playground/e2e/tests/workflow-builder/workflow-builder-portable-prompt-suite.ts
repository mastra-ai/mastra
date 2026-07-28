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

const scenarioMetadata = {
  'portable-echo-workflow': {
    fixture: 'workflow-builder-portable-echo',
    expectedGraphEntry: 'echo-message',
  },
  'portable-greeting-workflow': {
    fixture: 'workflow-builder-portable-greeting',
    expectedGraphEntry: 'format-greeting',
  },
  'portable-order-status-workflow': {
    fixture: 'workflow-builder-portable-order-status',
    expectedGraphEntry: 'shape-order-status',
  },
  'portable-profile-workflow': {
    fixture: 'workflow-builder-portable-profile',
    expectedGraphEntry: 'project-profile',
  },
  'portable-tags-workflow': {
    fixture: 'workflow-builder-portable-tags',
    expectedGraphEntry: 'copy-tags',
  },
  'portable-chained-mapping-workflow': {
    fixture: 'workflow-builder-portable-chained-mapping',
    expectedGraphEntry: 'copy-normalized-value',
  },
  'portable-receipt-workflow': {
    fixture: 'workflow-builder-portable-receipt',
    expectedGraphEntry: 'format-receipt',
  },
  'portable-defaults-workflow': {
    fixture: 'workflow-builder-portable-defaults',
    expectedGraphEntry: 'create-defaults',
  },
} satisfies Record<PortableWorkflowScenarioId, { fixture: Fixtures; expectedGraphEntry: string }>;

const isPortableScenarioId = (value: string): value is PortableWorkflowScenarioId => value in scenarioMetadata;

export const portableWorkflowScenarios = promptSuite.scenarios.map(scenario => {
  if (!isPortableScenarioId(scenario.id)) {
    throw new Error(`Unknown portable workflow scenario: ${scenario.id}`);
  }

  const metadata = scenarioMetadata[scenario.id];
  if (metadata.fixture !== scenario.fixture || metadata.expectedGraphEntry !== scenario.expectedGraphEntry) {
    throw new Error(`Portable workflow metadata drift for ${scenario.id}`);
  }

  return { ...scenario, id: scenario.id, ...metadata };
});
