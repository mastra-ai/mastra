import { checkCancellation, executionSignal, runCancellable } from './cancellation.ts';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { IntakeCoordinator } from '../intake/adapters.ts';
import { readSource, canonicalJson } from '../intake/source.ts';
import { defaultLimits } from '../contracts/limits.ts';
import { scopedRunId } from '../contracts/review.ts';
import type { ReviewState, ReviewDecision } from '../contracts/review.ts';
import type { ConfirmedInputMapping } from '../contracts/mapping.ts';
import type { InputInspection } from '../contracts/inspection.ts';
import type { InputSourceSnapshot } from '../intake/source.ts';
import type { z } from 'zod';
import type { evidenceProfileSchema } from '../contracts/profile.ts';
import { buildEvidenceSnapshot, loadManifest } from '../evidence/snapshot.ts';
import { openIntakeStore } from '../persistence/store.ts';
import { openReviewStore } from '../persistence/review.ts';
import { openRespondStore } from '../persistence/respond.ts';
import { prepareCompletion } from '../persistence/completion.ts';
import { submitReview } from '../review/service.ts';
import { publishExport } from '../exports/publication.ts';
import { recoverQuestionnaire } from '../workflows/vendor-risk-questionnaire.ts';
import type { createQuestionnaireWorkflow } from '../workflows/vendor-risk-questionnaire.ts';
import type { ModelFactory } from '../processing/model.ts';

export interface OperatorInteraction {
  show(text: string): void;
  ask(prompt: string): Promise<string | null>;
}
// Preserve readable lines while removing terminal escape/control sequences from untrusted content.
export const terminalText = (value: string) =>
  value
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '');
// Generated technical IDs use letters so local PII rules cannot mistake random digit runs for phone numbers.
const generatedId = () => randomUUID().replace(/[0-9]/g, digit => String.fromCharCode(103 + Number(digit)));
async function answer(io: OperatorInteraction, prompt: string) {
  const value = await io.ask(prompt);
  if (value === null || value.trim().toLowerCase() === 'cancel') throw new Error('OPERATOR_CANCELLED');
  return value.trim();
}
async function mappingFor(
  source: InputSourceSnapshot,
  inspection: InputInspection,
  io: OperatorInteraction,
  remembered: Record<string, string>,
  save: () => Promise<void>,
): Promise<ConfirmedInputMapping> {
  if (inspection.mappingCandidates.length === 1) return inspection.mappingCandidates[0]!;
  const regions: ConfirmedInputMapping['regions'] = [],
    exclusions: ConfirmedInputMapping['exclusions'] = [];
  for (const region of inspection.regions) {
    const question = async (prompt: string) => {
      const key = `${region.id}:${prompt}`;
      if (remembered[key] !== undefined) return remembered[key]!;
      const value = await answer(io, prompt);
      remembered[key] = value;
      await save();
      return value;
    };
    if (!region.candidateCount) continue;
    io.show(`Region ${region.id}: ${region.candidateCount} candidate rows; ${region.columnCount} columns.`);
    const choice = await question('Map this region or exclude inspected non-question content? [map/exclude/cancel] ');
    if (choice === 'exclude') {
      const reason = await question('Reason for excluding this non-question region: ');
      if (!reason) throw new Error('EXCLUSION_REASON_REQUIRED');
      exclusions.push({
        regionId: region.id,
        startRow: Math.min(...region.candidateRows),
        endRow: Math.max(...region.candidateRows),
        reason,
      });
    } else if (choice === 'map' && region.classification !== 'unsupported') {
      const first = Number(await question('First question row (zero-based): ')),
        last = Number(await question('Last question row (zero-based): '));
      const fields: ConfirmedInputMapping['regions'][number]['fields'] = { question: 0 };
      if (region.location.kind !== 'docx.paragraph')
        for (const role of [
          'question',
          'id',
          'type',
          'options',
          'instructions',
          'response',
          'explanation',
          'evidence',
        ] as const) {
          const value = await question(
            `Column for ${role} (zero-based${role === 'question' ? '' : ', blank if absent'}): `,
          );
          if (value !== '') fields[role] = Number(value);
        }
      regions.push({ regionId: region.id, startRow: first, endRow: last, fields });
      for (const row of region.candidateRows.filter(r => r < first || r > last)) {
        const reason = await question(`Reason to exclude row ${row} as non-question content: `);
        exclusions.push({ regionId: region.id, startRow: row, endRow: row, reason });
      }
    } else throw new Error('UNSUPPORTED_MAPPING_CHOICE');
  }
  return {
    contractVersion: 1,
    sourceSha256: source.sha256,
    adapterKey: inspection.adapterKey,
    adapterVersion: inspection.adapterVersion,
    profileVersion: 1,
    profile: regions.every(r => r.regionId.startsWith('paragraph:'))
      ? 'docx.blocks.v1'
      : `${inspection.adapterKey}.table.v1`,
    regions,
    exclusions,
  };
}
function display(state: ReviewState, io: OperatorInteraction) {
  io.show(`Review ${state.runId}, revision ${state.revision}.`);
  for (const q of state.questions) {
    const result = state.results.find(r => r.questionId === q.id)!;
    const final = state.projection?.answers.find(a => a.questionId === q.id);
    io.show(
      terminalText(
        `\n${q.order + 1}. ${q.id}: ${q.originalText}\nStatus: ${final?.disposition ?? result.status}\n${final ? [final.value, final.text, final.safeReason, ...final.limitations].join('\n') : [result.draft?.value ?? 'unknown', result.draft?.text ?? '', ...(result.draft?.limitations ?? []), ...result.reasons].join('\n')}\nCitations: ${final?.citationIds.join(', ') ?? result.draft?.citations.map(c => `${c.documentId}; ${c.version}; ${canonicalJson(c.locator)}`).join('\n') ?? 'none'}`,
      ),
    );
  }
}
export interface RespondOptions {
  databaseUrl: string;
  runtimeRoot: string;
  profile: z.infer<typeof evidenceProfileSchema>;
  workflow: ReturnType<typeof createQuestionnaireWorkflow>;
  io: OperatorInteraction;
  models?: ModelFactory;
  sourcePath?: string;
  resume?: string;
}
export async function prepareResponse(options: RespondOptions) {
  const { io, profile, workflow } = options;
  const runId = scopedRunId.parse(options.resume ?? generatedId());

  const store = await openIntakeStore(options.databaseUrl),
    review = await openReviewStore(options.databaseUrl),
    checkpoints = await openRespondStore(options.databaseUrl);
  try {
    let state = await review.read(runId);
    let saved = await checkpoints.read(runId);
    if (!saved) {
      if (options.resume) throw new Error('RUN_NOT_FOUND');
      if (!options.sourcePath) throw new Error('SOURCE_PATH_REQUIRED');
      const source = await readSource(resolve(options.sourcePath), `input-${runId}`, defaultLimits);
      await checkpoints.initialize(runId, source, resolve(options.sourcePath));
      saved = (await checkpoints.read(runId))!;
    }
    io.show(`Run ID: ${runId}. Resume with npm run respond -- --resume ${runId}`);
    const checkpoint = saved.checkpoint;
    checkCancellation(runId);
    const signal = executionSignal(runId);
    const context = {
      limits: defaultLimits,
      signal: AbortSignal.any([AbortSignal.timeout(defaultLimits.timeoutMs), ...(signal ? [signal] : [])]),
    };
    if (!(await store.readIntake(runId))) {
      const source = saved.source;
      const coordinator = new IntakeCoordinator(),
        inspection = await coordinator.inspect(source, context);
      if (inspection.status === 'rejected') throw new Error('UNSUPPORTED_INTAKE');
      const mapping =
        checkpoint.mapping ??
        (await mappingFor(source, inspection, io, checkpoint.mappingAnswers, () => checkpoints.save(checkpoint)));
      checkpoint.mapping = mapping;
      await checkpoints.save(checkpoint);
      const imported = await coordinator.import(
        source,
        mapping,
        {
          questionnaireId: `questionnaire-${runId}`,
          organizationId: profile.scope.organizationId,
          title: 'Vendor questionnaire',
        },
        context,
      );
      const consent = checkpoint.consent;
      for (const q of imported.input.questions)
        for (const existing of q.untrustedExistingResponse ?? []) {
          if (consent.includes(canonicalJson(existing.locator))) continue;
          io.show(terminalText(`Untrusted prefilled target for ${q.id}: ${existing.text}`));
          if ((await answer(io, 'Replace this exact inspected value? Type REPLACE: ')).toUpperCase() !== 'REPLACE')
            throw new Error('PREFILLED_REPLACEMENT_DECLINED');
          consent.push(canonicalJson(existing.locator));
          await checkpoints.save(checkpoint);
        }
      await store.persistIntake(runId, imported.input, imported.mapping, source);
    }
    // Intake registers a plan, which may still need building after an interruption.
    checkCancellation(runId);
    await prepareCompletion(options.databaseUrl, runId, checkpoint.consent);
    if (!(await store.readEvidence(runId))) {
      const evidence = await buildEvidenceSnapshot({
        runId,
        root: profile.evidenceRoot,
        runtimeRoot: options.runtimeRoot,
        manifest: await loadManifest(profile.manifestPath),
        scope: profile.scope,
        context,
      });
      await store.persistEvidence(evidence.record, evidence.sources);
    }
    checkCancellation(runId);
    if (!state) {
      const workflowRunId = `respond-${runId}`,
        snapshot = await workflow.getWorkflowRunById(workflowRunId),
        run = await workflow.createRun({ runId: workflowRunId });
      const result = await runCancellable(runId, run, () =>
        snapshot
          ? run.restart()
          : run.start({
              inputData: {
                runId,
                evidenceRoot: profile.evidenceRoot,
                manifestPath: profile.manifestPath,
                policy: profile.policy,
              },
            }),
      );
      if (result.status !== 'suspended') throw new Error('DRAFT_WORKFLOW_INCOMPLETE');
      state = await review.read(runId);
    }
    if (!state) throw new Error('REVIEW_STATE_REQUIRED');
    return { state, checkpoint };
  } finally {
    store.close();
    review.close();
    checkpoints.close();
  }
}
export async function respond(options: RespondOptions) {
  const { io, profile, workflow } = options;
  let { state, checkpoint } = await prepareResponse(options);
  const runId = state.runId;
  const store = await openIntakeStore(options.databaseUrl),
    review = await openReviewStore(options.databaseUrl),
    checkpoints = await openRespondStore(options.databaseUrl);
  try {
    const reviewOptions = { ...options, evidenceRoot: profile.evidenceRoot, manifestPath: profile.manifestPath };
    if (state.state === 'exported') {
      const { path, manifest } = await publishExport(runId, reviewOptions);
      return { path, manifest };
    }
    if (state.state === 'invalidated') throw new Error('RUN_INVALIDATED');
    if (state.state === 'awaiting_review') {
      display(state, io);
      if (checkpoint.reviewRevision !== state.revision || checkpoint.reviewDigest !== state.digest) {
        checkpoint.reviewRevision = state.revision;
        checkpoint.reviewDigest = state.digest;
        checkpoint.dispositions = [];
        delete checkpoint.reviewIssue;
        await checkpoints.save(checkpoint);
      }
      if (checkpoint.reviewIssue) io.show(`Previous review validation failed: ${checkpoint.reviewIssue}.`);
      const dispositions: ReviewDecision['dispositions'] = checkpoint.dispositions;
      for (const q of state.questions) {
        const existing = dispositions.findIndex(d => d.questionId === q.id);
        if (existing !== -1) {
          if (state.projection) continue;
          const proposal = dispositions[existing]!,
            evidence = await store.readEvidence(runId);
          io.show(
            terminalText(
              [
                `${q.id}: saved proposal ${proposal.disposition}${proposal.correction ? ' with correction' : ''}.`,
                proposal.correction?.text ?? '',
                `Reason: ${proposal.safeReason}`,
                `Released sources: ${
                  proposal.releaseDocumentIds
                    .map(id => evidence?.documents.find(d => d.id === id)?.citationLabel ?? id)
                    .join(', ') || 'none'
                }`,
              ]
                .filter(Boolean)
                .join('\n'),
            ),
          );
          const retry = await answer(io, `${q.id}: keep this proposal or change it? [keep/change/cancel] `);
          if (retry === 'keep') continue;
          if (retry !== 'change') throw new Error('INVALID_REVIEW_CHOICE');
        }
        const result = state.results.find(r => r.questionId === q.id)!;
        const selection = await answer(
          io,
          `${q.id}: release draft, correct supported draft, unknown, or withheld? [release/correct/unknown/withheld/cancel] `,
        );
        if (!['release', 'correct', 'unknown', 'withheld'].includes(selection))
          throw new Error('INVALID_REVIEW_CHOICE');
        const disposition = selection === 'correct' ? 'release' : (selection as 'release' | 'unknown' | 'withheld');
        let correction;
        if (selection === 'correct') {
          if (!result.draft || !result.draft.claims.length) throw new Error('SUPPORTED_DRAFT_REQUIRED');
          const text = await answer(
            io,
            'Corrected supported response text (citations and authority remain validated): ',
          );
          correction = {
            ...result.draft,
            text,
            claims: result.draft.claims.map((c, i) => (i === 0 ? { ...c, text } : c)),
          };
        }
        const releaseDocumentIds: string[] = [];
        if (disposition === 'release') {
          const evidence = await store.readEvidence(runId);
          for (const id of new Set((correction ?? result.draft)?.citations.map(c => c.documentId) ?? []))
            if (
              evidence?.documents.find(d => d.id === id)?.disclosure === 'review_required' &&
              (await answer(io, `Explicitly release approved source ${id}? Type RELEASE: `)) === 'RELEASE'
            )
              releaseDocumentIds.push(id);
        }
        const proposed = {
          questionId: q.id,
          disposition,
          correction,
          releaseDocumentIds,
          safeReason:
            disposition === 'release'
              ? 'Supported by approved evidence.'
              : disposition === 'unknown'
                ? 'No releasable supported answer is available.'
                : 'Evidence is withheld.',
        };
        if (existing === -1) dispositions.push(proposed);
        else dispositions[existing] = proposed;
        await checkpoints.save(checkpoint);
      }
      try {
        state = (await submitReview(
          {
            decisionId: generatedId(),
            runId,
            organizationId: state.organizationId,
            expectedRevision: state.revision,
            expectedDigest: state.digest,
            policyDigest: state.policyDigest,
            dispositions,
            finalApproval: false,
          },
          reviewOptions,
        ))!;
      } catch (error) {
        checkpoint.reviewIssue =
          error instanceof Error && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.message)
            ? error.message
            : 'REVIEW_VALIDATION_FAILED';
        await checkpoints.save(checkpoint);
        throw error;
      }
      delete checkpoint.reviewIssue;
      checkpoint.reviewRevision = state.revision;
      checkpoint.reviewDigest = state.digest;
      await checkpoints.save(checkpoint);
      display(state, io);
      if ((await answer(io, 'Approve this complete displayed set? Type APPROVE: ')) !== 'APPROVE')
        throw new Error('FINAL_APPROVAL_DECLINED');
      const latest = await review.read(runId);
      if (latest?.revision !== state.revision || latest.digest !== state.digest) throw new Error('STALE_REVIEW');
      state = (await submitReview(
        {
          decisionId: generatedId(),
          runId,
          organizationId: state.organizationId,
          expectedRevision: state.revision,
          expectedDigest: state.digest,
          policyDigest: state.policyDigest,
          dispositions,
          finalApproval: true,
        },
        reviewOptions,
      ))!;
    }
    const recovered = await recoverQuestionnaire(workflow, state.workflowRunId);
    let output;
    if (recovered.reader.getStatus() === 'failed' && state.state === 'approved') {
      // A failed native run cannot resume. Retry only publication of the exact
      // saved approval, as the standalone export command does, without redrafting.
      const approval = recovered.reader.getStepOutput<{
        runId: string;
        revision: number;
        approvalId: string;
      }>('review-answer-set');
      if (
        !approval ||
        Array.isArray(approval) ||
        approval.runId !== runId ||
        approval.revision !== state.revision ||
        approval.approvalId !== state.projection!.approvalId
      )
        throw new Error('STALE_REVIEW');
      const { path, manifest } = await publishExport(runId, reviewOptions);
      output = { path, manifest };
    } else {
      const result = await recovered.run.resume({
        step: 'review-answer-set',
        resumeData: {
          approvalId: state.projection!.approvalId,
          revision: state.revision,
          digest: state.digest,
        },
      });
      if (result.status === 'failed') throw result.error;
      if (result.status !== 'success') throw new Error('PUBLICATION_INCOMPLETE');
      output = result.result;
    }
    io.show(
      `${output.path}\n${output.manifest.quality}: ${state.projection!.supported}/${state.projection!.total} supported.`,
    );
    return output;
  } finally {
    store.close();
    review.close();
    checkpoints.close();
  }
}
