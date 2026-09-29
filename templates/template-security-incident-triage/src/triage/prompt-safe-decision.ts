import { z } from 'zod';

import type { DecisionContext } from './decision-context.js';
import type {
  ContainmentAnalysisCandidateSchema,
  SeverityAnalysisCandidateSchema,
  SummaryAnalysisCandidateSchema,
} from './decision-contracts.js';

const PromptSafeDecisionFactSchema = z
  .object({
    factToken: z.string().regex(/^fact-(?:[1-9]|[1-4][0-9])$/u),
    typeToken: z.string().regex(/^type-(?:[1-9]|[1-4][0-9])$/u),
    valueToken: z.string().regex(/^value-(?:[1-9]|[1-4][0-9])$/u),
    valueType: z.enum(['string', 'number', 'boolean', 'null']),
    confidenceBand: z.enum(['below-threshold', 'meets-threshold']),
    incomplete: z.boolean(),
  })
  .strict();

export const DecisionProjectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    incidentKindToken: z.enum(['kind-1', 'kind-2', 'kind-3']),
    evidence: z.array(PromptSafeDecisionFactSchema).max(48),
    contradictionCount: z.number().int().min(0).max(1_128),
    missingDataCount: z.number().int().min(0).max(48),
    runbookSectionTokens: z.array(z.string().regex(/^section-[1-9]$/u)).length(9),
  })
  .strict();

export type ResponsePlannerRequest =
  | Readonly<{
      task: 'severity';
      projection: z.infer<typeof DecisionProjectionSchema>;
      candidate: z.infer<typeof SeverityAnalysisCandidateSchema>;
    }>
  | Readonly<{
      task: 'summary';
      projection: z.infer<typeof DecisionProjectionSchema>;
      candidate: z.infer<typeof SummaryAnalysisCandidateSchema>;
    }>
  | Readonly<{
      task: 'containment';
      projection: z.infer<typeof DecisionProjectionSchema>;
      candidate: z.infer<typeof ContainmentAnalysisCandidateSchema>;
    }>;

export type ResponsePlannerInvoker = (
  request: ResponsePlannerRequest,
  attempt: 1 | 2,
  signal?: AbortSignal,
) => Promise<unknown>;

export function projectDecisionContext(context: DecisionContext) {
  const typeTokens = new Map<string, string>();
  const valueTokens = new Map<string, string>();
  return DecisionProjectionSchema.parse({
    schemaVersion: 1,
    incidentKindToken: {
      unauthorized_privilege_change: 'kind-1',
      disallowed_country_login: 'kind-2',
      unknown_device_login: 'kind-3',
    }[context.correlation.context.incidentKind],
    evidence: context.evidence.map((item, index) => ({
      factToken: `fact-${index + 1}`,
      typeToken: token(typeTokens, String(item.fact.factType), 'type'),
      valueToken: token(valueTokens, valueKey(item.fact.value), 'value'),
      valueType: valueType(item.fact.value),
      confidenceBand: item.confidence >= 0.8 ? 'meets-threshold' : 'below-threshold',
      incomplete: item.incomplete,
    })),
    contradictionCount: context.correlation.contradictions.length,
    missingDataCount: context.correlation.missingData.length,
    runbookSectionTokens: context.runbook.sections.map((_section, index) => `section-${index + 1}`),
  });
}

export async function deterministicResponsePlanner(request: ResponsePlannerRequest): Promise<unknown> {
  return request.candidate;
}

function token(map: Map<string, string>, key: string, prefix: 'type' | 'value') {
  const existing = map.get(key);
  if (existing) return existing;
  const created = `${prefix}-${map.size + 1}`;
  map.set(key, created);
  return created;
}

function valueKey(value: unknown): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function valueType(value: unknown): 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'null';
}
