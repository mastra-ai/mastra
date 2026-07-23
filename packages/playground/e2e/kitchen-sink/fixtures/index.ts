import type { Fixtures } from '../types';
import {
  agentBuilderComplexFixture,
  agentBuilderOnboardingFixture,
  agentBuilderPrReviewerFixture,
  agentBuilderStandupFixture,
  agentBuilderSupportFixture,
} from './agent-builder.fixture';
import {
  omObservationSuccessFixture,
  omObservationFailedFixture,
  omReflectionFixture,
  omSharedBudgetFixture,
} from './om-observation.fixture';
import { textStreamFixture } from './text-stream.fixture';
import { toolStreamFixture } from './tool-stream.fixture';
import { workflowStreamFixture } from './workflow-stream.fixture';
import { workflowBuilderLifecycleFixture } from './workflow-builder.fixture';

export const fixtures: Record<Fixtures, Array<unknown>> = {
  'text-stream': textStreamFixture,
  'tool-stream': toolStreamFixture,
  'workflow-stream': workflowStreamFixture,
  'om-observation-success': omObservationSuccessFixture,
  'om-observation-failed': omObservationFailedFixture,
  'om-reflection': omReflectionFixture,
  'om-shared-budget': omSharedBudgetFixture,
  'agent-builder-support': agentBuilderSupportFixture,
  'agent-builder-standup': agentBuilderStandupFixture,
  'agent-builder-pr-reviewer': agentBuilderPrReviewerFixture,
  'agent-builder-onboarding': agentBuilderOnboardingFixture,
  'agent-builder-complex': agentBuilderComplexFixture,
  'workflow-builder-lifecycle': workflowBuilderLifecycleFixture,
};

// Auth role fixtures for E2E testing
export * from './auth-roles.fixture';
