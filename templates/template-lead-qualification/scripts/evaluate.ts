import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { evaluateQualification, evaluationInputSchema } from '../src/mastra/evaluation';

const { values } = parseArgs({
  options: {
    labels: { type: 'string' },
    observations: { type: 'string' },
    output: { type: 'string' },
    reviews: { type: 'string' },
  },
});
if (!values.labels || !values.observations || !values.output)
  throw new Error('Supply --labels expected.json --observations observed.json --output report.json');
const labels = await readFile(values.labels, 'utf8');
const data = JSON.parse(await readFile(values.observations, 'utf8'));
if (values.reviews) data.semanticReviews = JSON.parse(await readFile(values.reviews, 'utf8'));
const observations = evaluationInputSchema.parse(data);
const report = evaluateQualification(labels, observations);
await writeFile(values.output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.info(
  JSON.stringify({ sampleCount: report.sampleCount, targetsMet: report.targetsMet, qualityClaim: report.qualityClaim }),
);
if (!report.targetsMet) process.exitCode = 1;
