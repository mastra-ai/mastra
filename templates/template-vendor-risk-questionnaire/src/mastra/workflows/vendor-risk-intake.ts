import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { id } from '../contracts/primitives.ts';
import { scopedRunId } from '../contracts/review.ts';
import { mappingSchema } from '../contracts/mapping.ts';
import { inspectionSchema } from '../contracts/inspection.ts';
import { evidenceScopeSchema } from '../contracts/evidence-snapshot.ts';
import { defaultLimits } from '../contracts/limits.ts';
import { executionPolicySchema, defaultExecutionPolicy } from '../contracts/execution-policy.ts';
import { draftInputSchema } from './vendor-risk-drafts/contracts.ts';
import { readSource } from '../intake/source.ts';
import { IntakeCoordinator } from '../intake/adapters.ts';
import { buildEvidenceSnapshot, loadManifest } from '../evidence/snapshot.ts';
import { openIntakeStore } from '../persistence/store.ts';
import { databaseUrl, runtimeRoot } from '../persistence/database.ts';
import { loadEvidenceProfile } from '../runtime/profile.ts';
import type { DraftWorkflowOptions } from './vendor-risk-drafts/runtime.ts';

export const studioIntakeSchema = z
  .object({
    runId: scopedRunId.default(() => randomUUID()),
    sourcePath: z.string().min(1).max(2000),
    sourceId: id,
    questionnaireId: id,
    organizationId: id.optional(),
    title: z.string().min(1).max(300),
    evidenceRoot: z.string().min(1).max(2000).optional(),
    manifestPath: z.string().min(1).max(2000).optional(),
    scope: evidenceScopeSchema.optional(),
    policy: executionPolicySchema.optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const explicit = [v.organizationId, v.evidenceRoot, v.manifestPath, v.scope];
    if (explicit.some(x => x !== undefined) && explicit.some(x => x === undefined))
      c.addIssue({
        code: 'custom',
        message: 'Provide the complete evidence configuration or use the trusted profile.',
      });
    if (v.organizationId && v.scope && v.organizationId !== v.scope.organizationId)
      c.addIssue({ code: 'custom', message: 'Organization scope must agree.' });
    if (!v.scope && v.policy) c.addIssue({ code: 'custom', message: 'The trusted profile owns its execution policy.' });
  });
export function createIntakeWorkflow(options: DraftWorkflowOptions = {}) {
  const intake = createStep({
    id: 'confirm-input-mapping',
    inputSchema: studioIntakeSchema,
    outputSchema: draftInputSchema,
    suspendSchema: inspectionSchema,
    resumeSchema: z.object({ mapping: mappingSchema, confirm: z.literal(true) }).strict(),
    execute: async ({ inputData, resumeData, suspend }) => {
      const profile = inputData.scope
        ? {
            scope: inputData.scope,
            evidenceRoot: inputData.evidenceRoot!,
            manifestPath: inputData.manifestPath!,
            policy: inputData.policy ?? defaultExecutionPolicy,
          }
        : await loadEvidenceProfile(options.runtimeRoot ?? runtimeRoot);
      const context = { limits: defaultLimits, signal: AbortSignal.timeout(defaultLimits.timeoutMs) };
      const source = await readSource(inputData.sourcePath, inputData.sourceId, defaultLimits),
        coordinator = new IntakeCoordinator();
      const inspection = await coordinator.inspect(source, context);
      if (inspection.status === 'rejected') throw new Error('UNSUPPORTED_INTAKE');
      if (!resumeData) return suspend(inspection);
      const imported = await coordinator.import(
        source,
        resumeData.mapping,
        {
          questionnaireId: inputData.questionnaireId,
          organizationId: profile.scope.organizationId,
          title: inputData.title,
        },
        context,
      );
      const snapshot = await buildEvidenceSnapshot({
        runId: inputData.runId,
        manifest: await loadManifest(profile.manifestPath),
        root: profile.evidenceRoot,
        runtimeRoot: options.runtimeRoot ?? runtimeRoot,
        scope: profile.scope,
        context,
      });
      const store = await openIntakeStore(options.databaseUrl ?? databaseUrl);
      try {
        await store.persistIntake(inputData.runId, imported.input, imported.mapping, source);
        await store.persistEvidence(snapshot.record, snapshot.sources);
      } finally {
        store.close();
      }
      return {
        runId: inputData.runId,
        evidenceRoot: profile.evidenceRoot,
        manifestPath: profile.manifestPath,
        policy: profile.policy,
      };
    },
  });
  return createWorkflow({
    id: 'vendor-risk-intake',
    description:
      'Inspect an XLSX or DOCX, explicitly confirm mapping and persist canonical intake for the questionnaire workflow.',
    inputSchema: studioIntakeSchema,
    outputSchema: draftInputSchema,
    options: { autoRestartActiveRuns: false },
  })
    .then(intake)
    .commit();
}
export const vendorRiskIntake = createIntakeWorkflow();
