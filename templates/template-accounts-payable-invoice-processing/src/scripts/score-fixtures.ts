import { extractionFidelityScorer } from '../mastra/scorers/extraction-fidelity.ts';
import { invoiceFixtures } from './support.ts';

const scores: number[] = [],
  imperfect: string[] = [],
  regressions: string[] = [];
for (const fixture of invoiceFixtures) {
  const score = await extractionFidelityScorer.run({
    input: fixture.groundTruth,
    output: fixture.draft,
  });
  scores.push(score.score);
  if (score.score < 1) imperfect.push(fixture.document.id);
  if (score.score < fixture.minimumFidelity)
    regressions.push(`${fixture.document.id}:${score.score.toFixed(3)}<${fixture.minimumFidelity}`);
  console.log(`${fixture.document.id}: ${score.score.toFixed(3)} ${score.reason}`);
}
console.log(
  `mean=${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(3)} imperfect=${imperfect.join(',') || 'none'} regressions=${regressions.join(',') || 'none'}`,
);
if (regressions.length) throw new Error(`Extraction fidelity regressed: ${regressions.join(', ')}`);
