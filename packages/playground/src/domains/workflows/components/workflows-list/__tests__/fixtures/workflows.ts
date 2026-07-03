import type { GetWorkflowResponse, ListWorkflowRunsResponse } from '@mastra/client-js';

type StepInfo = GetWorkflowResponse['steps'][string];
type AllStepInfo = GetWorkflowResponse['allSteps'][string];

const stepInfo = (id: string): StepInfo => ({
  id,
  description: `${id} step`,
  inputSchema: '{}',
  outputSchema: '{}',
  resumeSchema: '{}',
  suspendSchema: '{}',
  stateSchema: '{}',
});

const allStepInfo = (id: string, isWorkflow: boolean): AllStepInfo => ({
  ...stepInfo(id),
  isWorkflow,
});

const workflowBase = (name: string, description: string): Omit<GetWorkflowResponse, 'steps' | 'allSteps'> => ({
  name,
  description,
  stepGraph: [],
  inputSchema: '{}',
  outputSchema: '{}',
  stateSchema: '{}',
});

/**
 * Mirrors the real-world registry shape: record keys are camelCase config
 * keys while each workflow's own id (`name`) is kebab-case, and nested step
 * ids reference the child's kebab id. Roster:
 * - prdShipProduct nests prd-groom-product AND prd-fix-product (registered)
 * - prdGroomProduct nests use-case-arch (inline, unregistered)
 * - prdFixProduct is a leaf with two plain steps
 * - engRunner is a plain leaf whose runs endpoint reports active runs
 * - loopA and loopB nest each other by kebab id → ancestor guard case
 */
export const workflowsFixture: Record<string, GetWorkflowResponse> = {
  prdShipProduct: {
    ...workflowBase('prd-ship-product', 'Single entry pipeline for product work'),
    steps: {
      triage: stepInfo('triage'),
      'prd-groom-product': stepInfo('prd-groom-product'),
      'prd-fix-product': stepInfo('prd-fix-product'),
    },
    allSteps: {
      triage: allStepInfo('triage', false),
      'prd-groom-product': allStepInfo('prd-groom-product', true),
      'prd-fix-product': allStepInfo('prd-fix-product', true),
      'prd-groom-product.use-case-arch': allStepInfo('prd-groom-product.use-case-arch', true),
    },
  },
  prdGroomProduct: {
    ...workflowBase('prd-groom-product', 'Feature lane grooming'),
    steps: {
      plan: stepInfo('plan'),
      'use-case-arch': stepInfo('use-case-arch'),
    },
    allSteps: {
      plan: allStepInfo('plan', false),
      'use-case-arch': allStepInfo('use-case-arch', true),
    },
  },
  prdFixProduct: {
    ...workflowBase('prd-fix-product', 'Bug pipeline'),
    steps: {
      rca: stepInfo('rca'),
      publish: stepInfo('publish'),
    },
    allSteps: {
      rca: allStepInfo('rca', false),
      publish: allStepInfo('publish', false),
    },
  },
  engRunner: {
    ...workflowBase('eng-runner', 'Long running ticket shipper'),
    steps: {
      build: stepInfo('build'),
    },
    allSteps: {
      build: allStepInfo('build', false),
    },
  },
  loopA: {
    ...workflowBase('loop-a', 'Nests loop-b'),
    steps: {
      'loop-b': stepInfo('loop-b'),
    },
    allSteps: {
      'loop-b': allStepInfo('loop-b', true),
    },
  },
  loopB: {
    ...workflowBase('loop-b', 'Nests loop-a back'),
    steps: {
      'loop-a': stepInfo('loop-a'),
    },
    allSteps: {
      'loop-a': allStepInfo('loop-a', true),
    },
  },
};

export const RUNNING_TOTALS: Record<string, number> = {
  engRunner: 3,
};

export const SUSPENDED_TOTALS: Record<string, number> = {
  prdGroomProduct: 2,
};

export const emptyRuns: ListWorkflowRunsResponse = { runs: [], total: 0 };

export const runsResponseFor = (workflowId: string, status: string | null): ListWorkflowRunsResponse => {
  const totals =
    status === 'running' ? RUNNING_TOTALS : status === 'suspended' ? SUSPENDED_TOTALS : ({} as Record<string, number>);
  return { runs: [], total: totals[workflowId] ?? 0 };
};
