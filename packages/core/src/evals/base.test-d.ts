import { test } from 'vitest';

import type { RequestContext } from '../request-context';
import { createScorer } from './base';

const model = 'anthropic/claude-haiku-5-5';
const cache = { anthropic: { cacheControl: { type: 'ephemeral' as const } } };
const typedInstructions = ({ requestContext }: { requestContext: RequestContext<{ report: string }> }) =>
  requestContext.get('report');

test('judge instructions accept the same forms as agent instructions', () => {
  const forms = [
    { model, instructions: 'Score the report.' },
    { model, instructions: ['Score the report.', 'Use a 0 to 1 scale.'] },
    { model, instructions: { role: 'system' as const, content: 'Score the report.', providerOptions: cache } },
    { model, instructions: [{ role: 'system' as const, content: 'Score the report.', providerOptions: cache }] },
    { model, instructions: typedInstructions },
  ];

  for (const judge of forms) {
    createScorer({ id: 'report-judge', description: 'Scores a report', judge });
  }
});

test('dynamic judge instructions get a request context on the scorer and on a step', () => {
  createScorer({
    id: 'report-judge',
    description: 'Scores a report',
    judge: {
      model,
      instructions: ({ requestContext }) => [
        { role: 'system', content: `Report: ${requestContext.get('report')}`, providerOptions: cache },
      ],
    },
  }).generateScore({
    description: 'Accuracy',
    judge: { model, instructions: async ({ requestContext }) => `Report: ${requestContext.get('report')}` },
    createPrompt: () => 'How accurate is it?',
  });
});
