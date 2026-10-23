import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { workflowCorpus } from '../src/mastra/evals/workflow-corpus.js';
import { runLocalDemoCase } from './demo/run-local-demo.js';

try {
  const { values } = parseArgs({ options: { output: { type: 'string' } } });
  if (!values.output) throw new Error('Use demo:local -- --output NEW_DIRECTORY');
  const directory = resolve(values.output);
  await mkdir(directory);
  const cases = [];
  for (const testCase of workflowCorpus.filter(item => item.decision === 'approved')) {
    cases.push(await runLocalDemoCase(testCase, directory));
    console.log(`Verified signed webhook, approval and local effects: ${testCase.id}`);
  }
  const report = {
    schemaVersion: 1,
    mode: 'synthetic-local-webhook-background-workflow',
    model: 'none-injected-deterministic-invokers',
    cases,
    passed: cases.length === 3 && cases.every(item => item.passed),
  };
  await writeFile(join(directory, 'demo-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'LOCAL_DEMO_FAILED');
  process.exitCode = 1;
}
