import { questionInterpretationAgent } from '../../src/mastra/agents/question-interpretation.ts';
import { evidenceAnswerAgent } from '../../src/mastra/agents/evidence-answer.ts';
import { supportVerifierAgent } from '../../src/mastra/agents/support-verifier.ts';
import { answerConsistencyAgent } from '../../src/mastra/agents/answer-consistency.ts';
import { Mastra } from '@mastra/core';
import { createNativeStorage } from '../../src/mastra/persistence/database.ts';
import { resolve } from 'node:path';
import { createQuestionnaireWorkflow } from '../../src/mastra/workflows/vendor-risk-questionnaire.ts';
import { openReviewStore } from '../../src/mastra/persistence/review.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';
import { fixturePolicy } from './policy.ts';
import type { ExecutionPolicy } from '../../src/mastra/contracts/execution-policy.ts';
import type { ReviewDecision } from '../../src/mastra/contracts/review.ts';
import type { CasePlan, DraftFixture } from './drafting.ts';
import { draftingFixture, controlledProvider } from './drafting.ts';

export function attachParent(fixture: DraftFixture, models: ReturnType<typeof controlledProvider>['factory']) {
  const native = createNativeStorage('review-local', fixture.url);
  const workflow = createQuestionnaireWorkflow({
    storageOwner: native.owner,
    databaseUrl: fixture.url,
    runtimeRoot: fixture.runtimeRoot,
    models,
  });
  const storage = native.storage;
  const mastra = new Mastra({
    storage,
    agents: { questionInterpretationAgent, evidenceAnswerAgent, supportVerifierAgent, answerConsistencyAgent },
    workflows: { workflow },
  });
  return { workflow, storage, mastra };
}
export async function reviewFixture(
  root: string,
  options: Parameters<typeof draftingFixture>[1] = {},
  plans: CasePlan[] = [],
  policy: Partial<ExecutionPolicy> = {},
) {
  const fixture = await draftingFixture(root, options),
    provider = controlledProvider(fixture, plans),
    attached = attachParent(fixture, provider.factory);
  const run = await attached.workflow.createRun({ runId: options.runId ? `parent-${fixture.runId}` : 'parent-run' });
  const result = await run.start({
    inputData: {
      runId: fixture.runId,
      evidenceRoot: resolve(root, 'evidence'),
      manifestPath: fixture.manifestPath,
      policy: {
        ...fixturePolicy,
        ...policy,
      },
    },
  });
  const review = await openReviewStore(fixture.url),
    processing = await openProcessingStore(fixture.url);
  const state = (await review.read(fixture.runId))!,
    status = (await processing.status(fixture.runId))!;
  review.close();
  processing.close();
  return {
    ...fixture,
    ...attached,
    provider,
    run,
    result,
    state,
    status,
    options: {
      databaseUrl: fixture.url,
      runtimeRoot: fixture.runtimeRoot,
      evidenceRoot: resolve(root, 'evidence'),
      manifestPath: fixture.manifestPath,
      models: provider.factory,
    },
  };
}
export function decision(
  f: Awaited<ReturnType<typeof reviewFixture>>,
  changes: Partial<ReviewDecision> = {},
): ReviewDecision {
  return {
    decisionId: 'approve-1',
    runId: f.runId,
    organizationId: f.input.organizationId,
    expectedRevision: f.state.revision,
    expectedDigest: f.state.digest,
    policyDigest: f.state.policyDigest,
    finalApproval: true,
    dispositions: f.status.results.map(r => ({
      questionId: r.questionId,
      disposition: r.status === 'draft_eligible' ? 'release' : 'unknown',
      safeReason:
        r.status === 'draft_eligible'
          ? 'Supported by approved evidence.'
          : 'No releasable supported answer is available.',
      releaseDocumentIds: [],
    })),
    ...changes,
  };
}
