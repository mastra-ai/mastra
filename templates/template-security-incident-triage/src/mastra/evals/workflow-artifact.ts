import { z } from 'zod';
import {
  TriageResultSchema,
  IncidentSummaryV1Schema,
  SeverityDecisionSchema,
  ValidatedContainmentPlanSchema,
} from '../../triage/decision-contracts.js';

import {
  approvalRow,
  planRow,
  actionRow,
  attemptRow,
  effectRow,
  authorizationProbes,
} from './workflow-authority-schema.js';
export const WorkflowObservationSchema = z
  .object({
    caseId: z.string(),
    severity: z.string(),
    incidentStatus: z.string(),
    startStatus: z.string(),
    finalStatus: z.string(),
    responseStatus: z.string(),
    preApprovalEffects: z.number().int().nonnegative(),
    authorizationProbes,
    triage: TriageResultSchema,
    authority: z
      .object({
        evidence: z.array(z.object({ id: z.string(), hash: z.string() }).strict()),
        canonicalSummary: IncidentSummaryV1Schema.nullable(),
        canonicalDecision: SeverityDecisionSchema.nullable(),
        canonicalPlan: ValidatedContainmentPlanSchema.nullable(),
        runbookReference: z.string(),
        runbookHash: z.string(),
        mandatoryRules: z.array(z.string()),
        selectedRunbook: z
          .object({
            active: z.boolean(),
            hash: z.string(),
            rules: z.array(z.string()),
            allowedActions: z.array(z.string()),
          })
          .strict(),
        allowedActions: z.array(z.string()),
        approvals: z.array(approvalRow),
        plans: z.array(planRow),
        actions: z.array(actionRow),
        attempts: z.array(attemptRow),
        effects: z.array(effectRow),
      })
      .strict(),
  })
  .strict();
export type WorkflowObservation = z.infer<typeof WorkflowObservationSchema>;
export const WorkflowArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal('deterministic-local-workflow'),
    corpusVersion: z.string(),
    corpusHash: z.string(),
    population: z.number().int(),
    runner: z.literal('actual-mastra-libsql-local-providers'),
    model: z.literal('none-injected-deterministic-invokers'),
    observations: z.array(WorkflowObservationSchema),
  })
  .strict();
export type WorkflowArtifact = z.infer<typeof WorkflowArtifactSchema>;
