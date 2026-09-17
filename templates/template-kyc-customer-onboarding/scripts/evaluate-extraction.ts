import { runFixtureExtractionEval } from '../src/evals/extraction-accuracy.js';
import { FixtureDocumentExtractionProvider } from '../src/providers/local/fixture-document-extraction.js';
import { FixedClock } from '../src/providers/local/deterministic-primitives.js';

const result = await runFixtureExtractionEval(
  new FixtureDocumentExtractionProvider(new FixedClock(new Date('2026-08-21T12:00:00.000Z'))),
);

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 1;
