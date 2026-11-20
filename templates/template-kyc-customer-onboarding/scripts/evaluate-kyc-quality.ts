import { runDeterministicKycEval } from '../src/evals/kyc-quality.js';

const result = await runDeterministicKycEval();
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 1;
