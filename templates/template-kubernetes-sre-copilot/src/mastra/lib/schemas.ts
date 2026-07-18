/**
 * Shared Zod schemas used across tools, workflows, and agents.
 */

import { z } from 'zod';

/** Identifies a single Pod to diagnose. */
export const podIdentifierSchema = z.object({
  namespace: z.string().describe('Kubernetes namespace the Pod lives in'),
  podName: z.string().describe('Name of the Pod to diagnose'),
  context: z.string().optional().describe('Optional kubeconfig context / cluster to target'),
});

/** The four failure patterns this template knows how to triage. v1 covers exactly these. */
export const failureTypeSchema = z.enum(['CrashLoopBackOff', 'ImagePullBackOff', 'OOMKilled', 'PVCPending']);

/** Raw Pod status data pulled from the cluster via the read-only MCP tools. */
export const podContextSchema = z.object({
  namespace: z.string(),
  podName: z.string(),
  context: z.string().optional(),
  podJson: z.string().describe('Raw JSON/YAML of `pods_get` output for this Pod'),
});

export const classifiedPodSchema = podContextSchema.extend({
  failureType: failureTypeSchema,
  classificationReason: z.string().describe('Short explanation of why this pod status matched the failure type'),
});

/** One node in the evidence graph. Carries the raw tool output that supports it. */
export const evidenceNodeSchema = z.object({
  symptom: z.string().describe('A single observed fact, stated plainly, e.g. "Container Exit Code 137"'),
  supportingData: z.string().describe('Raw tool output (or a relevant excerpt of it) backing this node'),
  source: z.string().describe('Which read-only tool call produced this evidence, e.g. "pods_log(previous=true)"'),
});

/** Final structured diagnosis. Matches the PRD output schema (§7) exactly. */
export const diagnosisOutputSchema = z.object({
  failureType: failureTypeSchema,
  rootCause: z.string(),
  confidence: z.number().min(0).max(1),
  evidenceChain: z.array(evidenceNodeSchema),
  suggestedFix: z
    .string()
    .describe('Text-only recommendation. Never executed by this template — v1 has no write tools.'),
  riskLevel: z.enum(['low', 'medium', 'high']),
});

export type PodIdentifier = z.infer<typeof podIdentifierSchema>;
export type FailureType = z.infer<typeof failureTypeSchema>;
export type PodContext = z.infer<typeof podContextSchema>;
export type ClassifiedPod = z.infer<typeof classifiedPodSchema>;
export type EvidenceNode = z.infer<typeof evidenceNodeSchema>;
export type DiagnosisOutput = z.infer<typeof diagnosisOutputSchema>;
