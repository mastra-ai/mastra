import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  workflowCorpus,
  workflowCorpusHash,
  WORKFLOW_CORPUS_VERSION,
  evalHash,
} from '../src/mastra/evals/workflow-corpus.js';
import { scoreWorkflowArtifact } from '../src/mastra/evals/workflow-scorers.js';
import type { WorkflowArtifact } from '../src/mastra/evals/workflow-artifact.js';
import { runLocalWorkflow } from './evals/local-workflow.js';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { output: { type: 'string' }, input: { type: 'string' } },
  });
  const command = positionals[0];
  if (command === 'run' || (command === 'check' && values.output)) {
    if (!values.output || values.input) throw new Error('Use eval:run -- --output NEW_DIRECTORY');
    const directory = resolve(values.output);
    await mkdir(directory); // Exclusive ownership: never reuse an existing/live database directory.
    const observations = [];
    for (const testCase of workflowCorpus) {
      observations.push(await runLocalWorkflow(testCase, directory));
      console.log(`Completed ${testCase.id}`);
    }
    const artifact: WorkflowArtifact = {
      schemaVersion: 1,
      mode: 'deterministic-local-workflow',
      corpusVersion: WORKFLOW_CORPUS_VERSION,
      corpusHash: workflowCorpusHash,
      population: workflowCorpus.length,
      runner: 'actual-mastra-libsql-local-providers',
      model: 'none-injected-deterministic-invokers',
      observations,
    };
    await writeFile(join(directory, 'observations.json'), JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' });
    const report = {
      ...(await scoreWorkflowArtifact(artifact)),
      observationHash: evalHash(artifact),
    };
    await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } else if (command === 'report' || command === 'check') {
    if (!values.input || values.output) throw new Error('Use eval:report or eval:check -- --input observations.json');
    const artifact: unknown = JSON.parse(await readFile(resolve(values.input), 'utf8'));
    const report = {
      ...(await scoreWorkflowArtifact(artifact)),
      observationHash: evalHash(artifact),
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
  } else throw new Error('Expected run, report or check');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'EVAL_FAILED');
  process.exitCode = 1;
}
