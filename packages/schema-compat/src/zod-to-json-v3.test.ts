import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// No mock needed - code now imports from 'zod/v3' directly, which is v3
// Run the shared test suite with Zod v3
runZodToJsonTestSuite();
