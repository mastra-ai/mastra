import { vi } from 'vitest';
import { z as zV3 } from 'zod/v3';
import { runTestSuite } from './utils-test-suite';

vi.mock('zod', () => ({
  z: zV3,
}));

runTestSuite();
