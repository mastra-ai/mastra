import { Fixtures } from '../types';
import { textStreamFixture } from './text-stream.fixture';
import { toolStreamFixture } from './tool-stream.fixture';
import { workflowStreamFixture } from './workflow-stream.fixture';
import {
  omObservationSuccessFixture,
  omObservationFailedFixture,
  omReflectionFixture,
  omAdaptiveThresholdFixture,
} from './om-observation.fixture';

export const fixtures: Record<Fixtures, Array<unknown>> = {
  'text-stream': textStreamFixture,
  'tool-stream': toolStreamFixture,
  'workflow-stream': workflowStreamFixture,
  'om-observation-success': omObservationSuccessFixture,
  'om-observation-failed': omObservationFailedFixture,
  'om-reflection': omReflectionFixture,
  'om-adaptive-threshold': omAdaptiveThresholdFixture,
};
