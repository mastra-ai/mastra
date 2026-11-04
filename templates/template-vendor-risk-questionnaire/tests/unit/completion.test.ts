import { it, expect } from 'vitest';
import { documentFixture } from '../support/completion.ts';
import { writePlanSchema } from '../../src/mastra/contracts/completion.ts';
import { renderedValues } from '../../src/mastra/completion/document.ts';

it('rejects_overlapping_and_unrepresentable_document_write_plans', async () => {
  const f = await documentFixture('xlsx'),
    plan = await f.plan();
  expect(
    writePlanSchema.safeParse({ ...plan, questions: [...plan.questions, { ...plan.questions[0], id: 'Q2', order: 1 }] })
      .success,
  ).toBe(false);
  expect(
    writePlanSchema.safeParse({
      ...plan,
      questions: plan.questions.map(q => ({ ...q, targets: q.targets.filter(t => t.role === 'evidence') })),
    }).success,
  ).toBe(false);
  expect(
    writePlanSchema.safeParse({
      ...plan,
      questions: plan.questions.map(q => ({
        ...q,
        constraints: {
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        },
        targets: q.targets.filter(t => t.role !== 'explanation'),
      })),
    }).success,
  ).toBe(false);
  expect(() =>
    renderedValues(
      { ...plan, questions: plan.questions.map(q => ({ ...q, constraints: { maxChars: 2 } })) },
      f.projection,
    ),
  ).toThrow('UNREPRESENTABLE_RESPONSE');
});
