import { runTestSuite } from './utils-test-suite';

// No mock needed - code now imports from 'zod/v3' directly, which is v3
runTestSuite();
