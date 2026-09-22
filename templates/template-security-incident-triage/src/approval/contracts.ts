import { z } from 'zod';

import {
  ApprovalRequestSchema,
  AuthoritativeApprovalResultSchema,
  ExpiredApprovalResultSchema,
} from '../schemas/approval.js';
import { ContainmentActionOutcomeSchema, ContainmentPlanSchema } from '../schemas/containment.js';
import { opaqueId } from '../schemas/common.js';
import {
  IncidentSummaryV1Schema,
  TriageBenignSchema,
  TriageBlockedSchema,
  TriageManualReviewSchema,
  SeverityDecisionSchema,
} from '../triage/decision-contracts.js';

export const ApprovalRequestedResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('approval-requested'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      approval: ApprovalRequestSchema,
      workflowRunId: opaqueId,
      correlationId: opaqueId,
    })
    .strict(),
  TriageBenignSchema,
  TriageManualReviewSchema,
  TriageBlockedSchema,
]);

export const ApprovalResolvedResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('approval-resolved'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      approval: ApprovalRequestSchema,
      authoritative: z.union([AuthoritativeApprovalResultSchema, ExpiredApprovalResultSchema]),
      workflowRunId: opaqueId,
      correlationId: opaqueId,
    })
    .strict(),
  TriageBenignSchema,
  TriageManualReviewSchema,
  TriageBlockedSchema,
]);

export const ContainmentExecutionResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('expired'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      authoritative: ExpiredApprovalResultSchema,
      workflowRunId: opaqueId,
      correlationId: opaqueId,
    })
    .strict(),
  z
    .object({
      status: z.literal('rejected'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      authoritative: AuthoritativeApprovalResultSchema,
      workflowRunId: opaqueId,
      correlationId: opaqueId,
    })
    .strict(),
  z
    .object({
      status: z.literal('containment-succeeded'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      authoritative: AuthoritativeApprovalResultSchema,
      workflowRunId: opaqueId,
      correlationId: opaqueId,
      outcomes: z.array(ContainmentActionOutcomeSchema).min(1).max(2),
    })
    .strict(),
  z
    .object({
      status: z.literal('containment-failed'),
      decision: SeverityDecisionSchema,
      summary: IncidentSummaryV1Schema,
      plan: ContainmentPlanSchema,
      authoritative: AuthoritativeApprovalResultSchema,
      workflowRunId: opaqueId,
      correlationId: opaqueId,
      partial: z.boolean(),
      outcomes: z.array(ContainmentActionOutcomeSchema).min(1).max(2),
    })
    .strict(),
  TriageBenignSchema,
  TriageManualReviewSchema,
  TriageBlockedSchema,
]);

export const IncidentResponseResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      status: z.literal('expired'),
      incidentId: opaqueId,
      approvalId: opaqueId,
    })
    .strict(),
  z
    .object({
      status: z.literal('rejected'),
      incidentId: opaqueId,
      approvalId: opaqueId,
    })
    .strict(),
  z
    .object({
      status: z.literal('contained'),
      incidentId: opaqueId,
      approvalId: opaqueId,
      outcomes: z.array(ContainmentActionOutcomeSchema).min(1).max(2),
    })
    .strict(),
  z
    .object({
      status: z.literal('failed'),
      incidentId: opaqueId,
      approvalId: opaqueId,
      partial: z.boolean(),
      outcomes: z.array(ContainmentActionOutcomeSchema).min(1).max(2),
    })
    .strict(),
  TriageBenignSchema,
  TriageManualReviewSchema,
  TriageBlockedSchema,
]);
export type ContainmentExecutionResult = z.infer<typeof ContainmentExecutionResultSchema>;
