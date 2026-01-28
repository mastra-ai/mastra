import { z } from 'zod';
import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// With vitest workspace alias, 'zod' resolves to 'zod-v3' for this test file
runZodToJsonTestSuite(z);
