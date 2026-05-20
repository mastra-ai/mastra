import { z } from 'zod';

export const BUILT_IN_PSYCHES = ['learner', 'integrator', 'critic', 'dreamer', 'modeler'] as const;

export type BuiltInPsycheName = (typeof BUILT_IN_PSYCHES)[number];

const stringFromUnknown = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const evidenceSchema = z.union([
  z.string().transform(value => ({ summary: value })),
  z
    .object({
      summary: z.string().optional(),
      source: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .passthrough()
    .transform(value => ({
      summary: value.summary ?? stringFromUnknown(value),
      source: value.source,
      confidence: value.confidence,
    })),
  z.record(z.string(), z.unknown()).transform(value => ({ summary: stringFromUnknown(value) })),
]);

const textItemSchema = z.union([z.string(), z.record(z.string(), z.unknown()).transform(stringFromUnknown)]);

const skillSignalSchema = z.union([
  z.string().transform(value => ({ name: value, reason: value, evidence: [] })),
  z
    .object({
      name: z.string().optional(),
      reason: z.string().optional(),
      summary: z.string().optional(),
      evidence: z.array(evidenceSchema).default([]),
    })
    .passthrough()
    .transform(value => ({
      name: value.name ?? value.summary ?? value.reason ?? 'Untitled skill signal',
      reason: value.reason ?? value.summary ?? value.name ?? 'No reason provided',
      evidence: value.evidence,
    })),
]);

const relationshipSchema = z.union([
  z.string().transform(value => ({ subject: value, relation: 'related_to', object: value, evidence: [] })),
  z
    .object({
      subject: z.string().optional(),
      relation: z.string().optional(),
      object: z.string().optional(),
      source: z.string().optional(),
      target: z.string().optional(),
      name: z.string().optional(),
      summary: z.string().optional(),
      evidence: z.array(evidenceSchema).default([]),
    })
    .passthrough()
    .transform(value => ({
      subject: value.subject ?? value.source ?? value.name ?? value.summary ?? 'Unknown subject',
      relation: value.relation ?? 'related_to',
      object: value.object ?? value.target ?? value.summary ?? 'Unknown object',
      evidence: value.evidence,
    })),
]);

export const builtInPsycheDefinitions = {
  learner: {
    schema: z.object({
      skillCandidates: z.array(skillSignalSchema).default([]),
      skillUpdates: z
        .array(
          z.union([
            z.string().transform(value => ({ name: value, change: value, evidence: [] })),
            z
              .object({
                name: z.string().optional(),
                change: z.string().optional(),
                reason: z.string().optional(),
                summary: z.string().optional(),
                evidence: z.array(evidenceSchema).default([]),
              })
              .passthrough()
              .transform(value => ({
                name: value.name ?? value.summary ?? value.reason ?? value.change ?? 'Untitled skill update',
                change: value.change ?? value.summary ?? value.reason ?? value.name ?? 'No change provided',
                evidence: value.evidence,
              })),
          ]),
        )
        .default([]),
    }),
    extractionInstructions: [
      'Extract reusable skill signals from this cycle for the learner psyche.',
      'Include possible new skill candidates and updates to existing skill procedures only.',
      'Do not include general knowledge, facts, or mental-model updates; those belong to other psyches.',
      'Return an object with keys: skillCandidates, skillUpdates.',
    ].join('\n'),
    agentInstructions: [
      'You are the learner psyche for Observational Memory.',
      'Curate durable skill procedures from extracted skill signals.',
      'Maintain concise skill notes in your workspace domain when the evidence is strong.',
      'Prefer small targeted edits over broad rewrites.',
    ].join('\n'),
    workspaceDomain: 'skills/',
  },
  integrator: {
    schema: z.object({
      knowledgeDeltas: z.array(textItemSchema).default([]),
      entities: z
        .array(
          z.union([
            z.string().transform(value => ({ name: value, summary: value, evidence: [] })),
            z
              .object({
                name: z.string().optional(),
                summary: z.string().optional(),
                description: z.string().optional(),
                evidence: z.array(evidenceSchema).default([]),
              })
              .passthrough()
              .transform(value => ({
                name: value.name ?? value.summary ?? value.description ?? 'Unknown entity',
                summary: value.summary ?? value.description ?? value.name ?? 'No summary provided',
                evidence: value.evidence,
              })),
          ]),
        )
        .default([]),
      relationships: z.array(relationshipSchema).default([]),
      staleKnowledge: z.array(textItemSchema).default([]),
    }),
    extractionInstructions: [
      'Extract durable knowledge-integration signals from this cycle for the integrator psyche.',
      'Include knowledge deltas, important entities, relationships, and stale knowledge that should be updated.',
      'Only include facts or relationships supported by the observed conversation/reflection context.',
      'Return an object with keys: knowledgeDeltas, entities, relationships, staleKnowledge.',
    ].join('\n'),
    agentInstructions: [
      'You are the integrator psyche for Observational Memory.',
      'Manage durable knowledge by integrating extracted facts, entities, relationships, and corrections.',
      'Maintain concise knowledge artifacts in your workspace domain with clear provenance when available.',
      'Prefer updating existing artifacts over creating new files.',
    ].join('\n'),
    workspaceDomain: 'knowledge/',
  },
  critic: {
    schema: z.object({
      risks: z.array(z.string()).default([]),
      contradictions: z.array(z.string()).default([]),
      policyConcerns: z.array(z.string()).default([]),
      securityConcerns: z.array(z.string()).default([]),
      needsReview: z.boolean().default(false),
    }),
    extractionInstructions: [
      'Extract critique signals from this cycle for the critic psyche.',
      'Look for risks, contradictions, policy concerns, security concerns, and whether human review is needed.',
      'Avoid inventing concerns; include only issues grounded in the observed conversation/reflection context.',
      'Return an object with keys: risks, contradictions, policyConcerns, securityConcerns, needsReview.',
    ].join('\n'),
    agentInstructions: [
      'You are the critic psyche for Observational Memory.',
      'Review extracted concerns for safety, policy, security, and reasoning quality.',
      'Persist durable concerns and review notes in your workspace domain.',
      'Do not block foreground execution; create actionable review artifacts instead.',
    ].join('\n'),
    workspaceDomain: 'review/',
  },
  dreamer: {
    schema: z.object({
      hypotheses: z.array(z.string()).default([]),
      unexpectedConnections: z.array(z.string()).default([]),
      experiments: z.array(z.string()).default([]),
      evidence: z.array(evidenceSchema).default([]),
    }),
    extractionInstructions: [
      'Extract creative synthesis signals from this cycle for the dreamer psyche.',
      'Include hypotheses, unexpected connections, possible experiments, and supporting evidence/provenance.',
      'Clearly separate speculation from evidence.',
      'Return an object with keys: hypotheses, unexpectedConnections, experiments, evidence.',
    ].join('\n'),
    agentInstructions: [
      'You are the dreamer psyche for Observational Memory.',
      'Explore plausible hypotheses, connections, and experiments without treating speculation as fact.',
      'Persist useful ideas and provenance in your workspace domain.',
      'Keep artifacts lightweight and easy for later agents to evaluate.',
    ].join('\n'),
    workspaceDomain: 'dreams/',
  },
  modeler: {
    schema: z.object({
      beliefUpdates: z.array(z.string()).default([]),
      causalAssumptions: z.array(z.string()).default([]),
      staleAssumptions: z.array(z.string()).default([]),
      unknowns: z.array(z.string()).default([]),
      questions: z.array(z.string()).default([]),
    }),
    extractionInstructions: [
      'Extract mental-model signals from this cycle for the modeler psyche.',
      'Include belief updates, causal assumptions, stale assumptions, unknowns, and open questions.',
      'Prefer precise updates that can improve future reasoning.',
      'Return an object with keys: beliefUpdates, causalAssumptions, staleAssumptions, unknowns, questions.',
    ].join('\n'),
    agentInstructions: [
      'You are the modeler psyche for Observational Memory.',
      'Maintain durable mental models, assumptions, and open questions.',
      'Update your workspace domain when extracted signals change what the system should believe or investigate.',
      'Mark uncertainty clearly.',
    ].join('\n'),
    workspaceDomain: 'mental-model/',
  },
} as const;
