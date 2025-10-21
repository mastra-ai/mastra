import { Fixtures } from '../types';
import { textStreamFixture } from './text-stream.fixture';
import { toolStreamFixture } from './tool-stream.fixture';

export const fixtures: Record<Fixtures, Array<unknown>> = {
  'text-stream': textStreamFixture,
  'tool-stream': toolStreamFixture,
};
