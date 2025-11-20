import { vi } from 'vitest';
import { z as zV3 } from 'zod/v3';
import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// Mock 'zod' to use v3
vi.mock('zod', () => ({
  z: zV3,
}));

// Run the shared test suite with Zod v3
runZodToJsonTestSuite();
