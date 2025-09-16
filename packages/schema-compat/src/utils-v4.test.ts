import { vi } from 'vitest';
import { z as zV4 } from 'zod/v4';
import { runTestSuite } from './utils-test-suite';

vi.mock('zod', () => ({
  z: zV4,
}));

runTestSuite();
