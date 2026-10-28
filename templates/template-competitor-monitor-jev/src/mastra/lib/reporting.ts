import { Agent } from '@mastra/core/agent';
import { ConsoleLogger } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';

import { MODEL_DEFAULTS, SUMMARY_LIMITS, TIMING, type MonitorConfig } from '../config';
import type { MonitorStore } from './store';

export const REPORT_SUMMARY_AGENT_ID = 'competitor-report-summary';

const summarySchema = z.object({
  explanation: z.string().trim().min(1).max(SUMMARY_LIMITS.explanationMaxCharacters),
  citedChangeIds: z.array(z.string().min(1)).max(SUMMARY_LIMITS.maxCitedChangeIds),
  quotedEvidence: z.array(z.string().min(1)).max(SUMMARY_LIMITS.maxQuotedEvidence),
});

export type ReportSummary = z.infer<typeof summarySchema>;

export const classificationProvenanceSchema = z.object({
  questionSetVersion: z.string(),
  ruleVersion: z.string(),
  model: z.object({
    requested: z.string().nullable(),
    reported: z.string().nullable(),
    verified: z.string().nullable(),
  }),
});

export const reportChangeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  status: z.enum(['classified', 'deferred', 'failed', 'pending']),
  route: z.enum(['alert', 'review', 'record', 'ignore']).optional(),
  reason: z.string().optional(),
  evidence: z.object({ sourceUrl: z.string().url(), beforeExcerpt: z.string(), afterExcerpt: z.string() }).optional(),
  provenance: classificationProvenanceSchema.optional(),
});

export type ReportChange = z.infer<typeof reportChangeSchema>;

export type Report = {
  summary?: ReportSummary;
  summaryFailure?:
    | 'SUMMARY_DISABLED'
    | 'SUMMARY_NOT_APPLICABLE'
    | 'SUMMARY_EVIDENCE_TOO_LARGE'
    | 'SUMMARY_NOT_CONFIGURED'
    | 'SUMMARY_FAILED'
    | 'SUMMARY_INVALID';
  changes: ReportChange[];
};

export type SummaryAgent = Pick<Agent, 'generate'>;

function createSummaryAgentRuntime() {
  return new Mastra({
    logger: new ConsoleLogger({
      name: REPORT_SUMMARY_AGENT_ID,
      level: 'debug',
      filter: ({ level }) => {
        if (level === 'error') console.error('SUMMARY_AGENT_REQUEST_FAILED', { agentId: REPORT_SUMMARY_AGENT_ID });
        return false;
      },
    }),
  });
}

export const reportSchema = z.object({
  summary: summarySchema.optional(),
  summaryFailure: z
    .enum([
      'SUMMARY_DISABLED',
      'SUMMARY_NOT_APPLICABLE',
      'SUMMARY_EVIDENCE_TOO_LARGE',
      'SUMMARY_NOT_CONFIGURED',
      'SUMMARY_FAILED',
      'SUMMARY_INVALID',
    ])
    .optional(),
});

/** The optional native Agent has no tools and receives only bounded, already persisted evidence. */
export function createReportSummaryAgent(apiKey: string) {
  return new Agent({
    id: REPORT_SUMMARY_AGENT_ID,
    name: 'Competitor report summary',
    mastra: createSummaryAgentRuntime(),
    // The installed native model router invokes OpenAI's Responses API at this explicit base URL.
    model: {
      id: MODEL_DEFAULTS.summary,
      url: 'https://api.openai.com/v1',
      api: 'responses',
      apiKey,
    },
    maxRetries: 0,
    instructions:
      'Explain only the supplied competitor-monitor evidence. Do not infer facts, use tools, or cite an ID or quote absent from the input.',
  });
}

function summaryInput(changes: ReportChange[]) {
  const maxCharacters = MODEL_DEFAULTS.summaryEvidenceMaxCharacters;
  const maxUtf8Bytes = MODEL_DEFAULTS.summaryPromptMaxUtf8Bytes;
  const selected: Array<Record<string, unknown>> = [];
  for (const change of changes) {
    const candidate = {
      id: change.id,
      route: change.route,
      sourceUrl: change.evidence?.sourceUrl,
      beforeExcerpt: change.evidence?.beforeExcerpt,
      afterExcerpt: change.evidence?.afterExcerpt,
    };
    const prompt = JSON.stringify([...selected, candidate]);
    if (prompt.length > maxCharacters || new TextEncoder().encode(prompt).byteLength > maxUtf8Bytes)
      return { oversizedCandidate: true } as const;
    selected.push(candidate);
  }
  return {
    prompt: JSON.stringify(selected),
    selectedIds: new Set(selected.map(change => String(change.id))),
    oversizedCandidate: false,
  };
}

function validSummary(summary: ReportSummary, changes: ReportChange[], suppliedIds: Set<string>) {
  const eligible = new Map(
    changes
      .filter(change => suppliedIds.has(change.id) && (change.route === 'alert' || change.route === 'review'))
      .map(change => [change.id, change]),
  );
  if (!summary.citedChangeIds.length || summary.citedChangeIds.some(id => !eligible.has(id))) return false;
  const quotes = new Set(
    [...eligible.values()].flatMap(change => [change.evidence?.beforeExcerpt, change.evidence?.afterExcerpt]),
  );
  return summary.quotedEvidence.every(quote => quotes.has(quote));
}

async function reportChanges(store: MonitorStore, changes: ReportChange[]) {
  return Promise.all(
    changes.map(async change => {
      const { provenance: _ignoredProvenance, ...reportedChange } = change;
      const [evidence, classification] = await Promise.all([
        store.evidence(change.id),
        store.classification(change.id),
      ]);
      return {
        ...reportedChange,
        ...(evidence
          ? {
              evidence: {
                sourceUrl: evidence.sourceUrl,
                beforeExcerpt: evidence.evidence.beforeExcerpt,
                afterExcerpt: evidence.evidence.afterExcerpt,
              },
            }
          : {}),
        ...(classification
          ? {
              provenance: {
                questionSetVersion: classification.questionSetVersion,
                ruleVersion: classification.ruleVersion,
                model: {
                  requested: modelIdentity(classification.audit, 'requestedModel'),
                  reported: modelIdentity(classification.audit, 'reportedModel'),
                  verified: modelIdentity(classification.audit, 'verifiedModel'),
                },
              },
            }
          : {}),
      };
    }),
  );
}

function modelIdentity(audit: Record<string, unknown>, field: 'requestedModel' | 'reportedModel' | 'verifiedModel') {
  const value = audit[field];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/** Assemble code-owned URLs/excerpts first; a summary can only add validated prose for alert or review. */
export async function buildReport(input: {
  changes: ReportChange[];
  generateSummary: boolean;
  config: MonitorConfig;
  store: MonitorStore;
  agent?: SummaryAgent;
}) {
  const changes = await reportChanges(input.store, input.changes);
  const eligible = changes.filter(change => change.route === 'alert' || change.route === 'review');
  if (!input.generateSummary) return { changes, summaryFailure: 'SUMMARY_DISABLED' } satisfies Report;
  if (!eligible.length) return { changes, summaryFailure: 'SUMMARY_NOT_APPLICABLE' } satisfies Report;
  const summaryRequest = summaryInput(eligible);
  if (summaryRequest.oversizedCandidate || !summaryRequest.selectedIds.size) {
    return {
      changes,
      summaryFailure: summaryRequest.oversizedCandidate ? 'SUMMARY_EVIDENCE_TOO_LARGE' : 'SUMMARY_NOT_APPLICABLE',
    } satisfies Report;
  }
  if (!input.config.credentials.openaiApiKey || !input.agent) {
    return { changes, summaryFailure: 'SUMMARY_NOT_CONFIGURED' } satisfies Report;
  }
  try {
    const generated = await input.agent.generate(summaryRequest.prompt, {
      abortSignal: AbortSignal.timeout(TIMING.summaryCallMs),
      modelSettings: { maxOutputTokens: MODEL_DEFAULTS.summaryMaxOutputTokens },
      providerOptions: { openai: { reasoningEffort: MODEL_DEFAULTS.summaryReasoning } },
      structuredOutput: { schema: summarySchema },
    });
    const summary = summarySchema.parse(generated.object);
    if (!validSummary(summary, eligible, summaryRequest.selectedIds))
      return { changes, summaryFailure: 'SUMMARY_INVALID' } satisfies Report;
    return { changes, summary } satisfies Report;
  } catch {
    return { changes, summaryFailure: 'SUMMARY_FAILED' } satisfies Report;
  }
}
