import { z } from 'zod';
import { createStep, createWorkflow } from './provider.js';

export const reviewMode = process.env.REVIEW_MODE ?? 'deterministic';
if (reviewMode !== 'deterministic' && reviewMode !== 'agent')
  throw new Error('REVIEW_MODE must be deterministic or agent');
export const inputSchema = z.object({
  draft: z.string().trim().min(1).max(100000),
  criteria: z.string().max(2000).default('Make this clear, coherent and easy to read.'),
  demoFailure: z.boolean().default(false),
});
const findingSchema = z.object({ focus: z.string(), feedback: z.string() });
const findingsSchema = z.array(findingSchema);
const revisionInput = z.object({ draft: z.string(), criteria: z.string(), findings: findingsSchema });
export const outputSchema = z.object({
  revisedDraft: z.string(),
  findings: findingsSchema,
  mode: z.enum(['deterministic', 'agent']),
});

function reviewer<const Id extends string>(id: Id, focus: string) {
  return createStep({
    id,
    inputSchema,
    outputSchema: findingSchema,
    execute: async ({ inputData, mastra }) => {
      if (inputData.demoFailure && id === 'clarity')
        throw new Error('Requested demonstration failure in the clarity review.');
      if (reviewMode === 'agent') {
        const response = await mastra
          .getAgent('reviewer')
          .generate(`Review this draft for ${focus}. Criteria: ${inputData.criteria}\n\n${inputData.draft}`, {
            structuredOutput: { schema: findingSchema },
          });
        return response.object;
      }
      // Deliberate delay makes the asynchronous UI and cancellation observable without a paid model.
      await new Promise(resolve => setTimeout(resolve, 750));
      const words = inputData.draft.split(/\s+/).length;
      const feedback =
        id === 'clarity'
          ? `Deterministic check: ${words} words. Check long sentences for a single main point.`
          : id === 'structure'
            ? 'Deterministic check: lead with the main point, then group related details.'
            : 'Deterministic check: use consistent names and terminology throughout.';
      return { focus, feedback };
    },
  });
}
const clarity = reviewer('clarity', 'clarity');
const structure = reviewer('structure', 'structure');
const consistency = reviewer('consistency', 'consistency');
const revise = createStep({
  id: 'revise',
  inputSchema: revisionInput,
  outputSchema,
  execute: async ({ inputData, mastra }) => {
    if (reviewMode === 'agent') {
      const response = await mastra
        .getAgent('editor')
        .generate(
          `Revise the draft using the findings. Preserve meaning and factual claims.\n${JSON.stringify(inputData)}`,
          { structuredOutput: { schema: z.object({ revisedDraft: z.string() }) } },
        );
      return { revisedDraft: response.object.revisedDraft, findings: inputData.findings, mode: 'agent' as const };
    }
    return {
      revisedDraft: inputData.draft.replace(/[ \t]+/g, ' ').trim(),
      findings: inputData.findings,
      mode: 'deterministic' as const,
    };
  },
});
export const editorialReview = createWorkflow({ id: 'editorial-review', inputSchema, outputSchema })
  .parallel([clarity, structure, consistency])
  .map(async ({ inputData, getInitData }) => {
    const original = getInitData<z.infer<typeof inputSchema>>();
    return {
      draft: original.draft,
      criteria: original.criteria,
      findings: [inputData.clarity, inputData.structure, inputData.consistency],
    };
  })
  .then(revise)
  .commit();
