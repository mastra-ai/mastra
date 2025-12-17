import { vi } from 'vitest';
import { z as zV4 } from 'zod/v4';
import { runTestSuite } from './utils-test-suite';

// Mock 'zod/v3' to use v4 (code imports from zod/v3)
vi.mock('zod/v3', () => ({
  z: zV4,
}));

runTestSuite();
