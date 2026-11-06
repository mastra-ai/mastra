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

test('judge instructions reject other types', () => {
  // @ts-expect-error instructions must be text, system messages, or a function that returns them
  createScorer({ id: 'report-judge', description: 'Scores a report', judge: { model, instructions: 42 } });
});
