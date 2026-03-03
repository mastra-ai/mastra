import type { Fixtures } from '../types';
import {
  omObservationSuccessFixture,
  omObservationFailedFixture,
  omReflectionFixture,
  omSharedBudgetFixture,
} from './om-observation.fixture';
import { textStreamFixture } from './text-stream.fixture';
import { toolStreamFixture } from './tool-stream.fixture';
import { workflowStreamFixture } from './workflow-stream.fixture';

export const fixtures: Record<Fixtures, Array<unknown>> = {
  'text-stream': textStreamFixture,
  'tool-stream': toolStreamFixture,
  'workflow-stream': workflowStreamFixture,
  'om-observation-success': omObservationSuccessFixture,
  'om-observation-failed': omObservationFailedFixture,
  'om-reflection': omReflectionFixture,
  'om-shared-budget': omSharedBudgetFixture,
};

// Auth role fixtures for E2E testing
export * from './auth-roles.fixture';
