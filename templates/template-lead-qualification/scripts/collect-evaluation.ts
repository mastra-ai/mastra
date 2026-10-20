import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { qualityFixtures, qualityHarness } from '../tests/support/quality';
import { prepareModelApproval, runModelCollection } from './model-collection';
import { evaluationLabelsSchema, textDigest } from '../src/mastra/evaluation';

const { values } = parseArgs({
  options: {
    controlled: { type: 'boolean' },
    'live-model': { type: 'boolean' },
    'plan-model': { type: 'boolean' },
    profiles: { type: 'string' },
    labels: { type: 'string' },
    approval: { type: 'string' },
    output: { type: 'string' },
  },
});
if (values['live-model'] || values['plan-model']) {
  if (
    values.controlled ||
    Boolean(values['live-model']) === Boolean(values['plan-model']) ||
    !values.profiles ||
    !values.labels ||
    !values.approval ||
    !values.output
  )
    throw new Error('Choose --plan-model or --live-model with --profiles --labels --approval --output');
  const paths = { profiles: values.profiles, labels: values.labels, approval: values.approval, output: values.output };
  if (values['plan-model']) {
    const { manifest } = await prepareModelApproval(paths);
    await writeFile(resolve(values.approval), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    console.info(
      JSON.stringify({ approval: resolve(values.approval), approved: false, executionId: manifest.executionId }),
    );
  } else await runModelCollection(paths);
} else {
  if (!values.controlled || !values.output || values.profiles || values.labels || values.approval)
    throw new Error('Choose --controlled --output <new artifact directory> for the original controlled dataset');
  const directory = resolve(values.output);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  const { profiles, labelText } = await qualityFixtures();
  const labels = evaluationLabelsSchema.parse(JSON.parse(labelText));
  const profileText = await readFile(
    new URL('../tests/fixtures/qualification/profiles.v1.json', import.meta.url),
    'utf8',
  );
  if (textDigest(profileText) !== labels.profilesDigest) throw new Error('evaluation_profile_digest_mismatch');
  const observations = [];
  const summaries = [];
  const app = await qualityHarness();
  try {
    for (const profile of profiles.cases) {
      const { assessment } = await app.assess(profile, profiles.assessmentTime);
      observations.push({ id: profile.id, assessment });
      summaries.push({
        id: profile.id,
        summary: assessment.summary,
        summaryDigest: textDigest(assessment.summary),
        evidence: assessment.evidence,
        facts: assessment.facts,
      });
      // Preserve completed observations on interruption or subsequent failure.
      await writeFile(
        resolve(directory, 'observations.json'),
        JSON.stringify(
          {
            datasetDigest: textDigest(labelText),
            profilesDigest: labels.profilesDigest,
            mode: 'controlled_functional',
            observations,
            semanticReviews: [],
          },
          null,
          2,
        ) + '\n',
        { mode: 0o600 },
      );
      await writeFile(resolve(directory, 'summary-review-material.json'), JSON.stringify(summaries, null, 2) + '\n', {
        mode: 0o600,
      });
    }
    await writeFile(
      resolve(directory, 'summary-reviews.template.json'),
      JSON.stringify(
        summaries.map(({ id, summaryDigest }) => ({
          id,
          reviewer: '',
          summaryDigest,
          unsupportedDecisiveClaims: [],
          allUnsupportedClaimsFlagged: false,
        })),
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.info(
      JSON.stringify({
        cases: observations.length,
        mode: 'controlled_functional',
        maximumOutputTokens: profiles.cases.length * 12000,
        hostedSearches: 0,
        pageRequests: 0,
        output: directory,
      }),
    );
  } finally {
    await app.close();
  }
}
