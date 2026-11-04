import { z } from 'zod';

import { INPUT_LIMITS, POLICY_DEFAULTS, RUBRIC, SOURCE_LIMITS } from './config';

/** Stable ID used to find persisted monitor or source history on later runs. */
const identifier = z.string().trim().min(1).max(INPUT_LIMITS.maxIdentifierChars);

/**
 * Type of page being monitored, supplied to Jev as source context. This describes the
 * page, not the type of change: a documentation page can announce a pricing change.
 * pricing = prices/plans; changelog = product updates; documentation = technical docs;
 * blog = articles/announcements; status = service status; other = any other public page.
 */
export const sourceKindSchema = z
  .enum(['pricing', 'changelog', 'documentation', 'blog', 'status', 'other'])
  .describe('Page type for classifier context: pricing, changelog, documentation, blog, status, or other.');

/** auto tries HTTP and falls back to a rendered browser when needed; http uses only HTTP; browser renders the page. */
export const fetchModeSchema = z
  .enum(['auto', 'http', 'browser'])
  .describe('How to collect the page: auto = HTTP with browser fallback; http = HTTP only; browser = rendered page.');

/** One public page to collect. Reuse its id and URL on subsequent runs to compare snapshots. */
export const sourceSchema = z
  .object({
    /** Stable source identity within a monitor; changing it starts a new source history. */
    id: identifier.describe('Stable source ID within this monitor; reuse it for later comparisons.'),
    /** Human-readable name shown in reports and sent to Jev as source context. */
    label: z.string().trim().min(1).max(INPUT_LIMITS.maxLabelChars).describe('Human-readable page name.'),
    /** Public HTTP(S) page to fetch; equivalent URLs are deduplicated. */
    url: z
      .string()
      .url()
      .max(INPUT_LIMITS.maxUrlChars)
      .superRefine((value, context) => {
        try {
          normalizedSourceUrl(value);
        } catch (error) {
          context.addIssue({
            code: 'custom',
            message: error instanceof TypeError ? 'INVALID_SOURCE_URL' : (error as Error).message,
          });
        }
      })
      .describe('Public HTTP(S) page URL without embedded credentials.'),
    /** Page category; see sourceKindSchema above for each accepted value. */
    kind: sourceKindSchema,
    /** Collection strategy; see fetchModeSchema above. */
    fetchMode: fetchModeSchema.default('auto'),
    /** Optional minimum extracted-text length; useful for genuinely short pages. */
    minContentChars: z
      .number()
      .int()
      .min(1)
      .max(SOURCE_LIMITS.minContentChars)
      .optional()
      .describe('Optional minimum accepted extracted-text length in characters.'),
    /** CSS selector for the meaningful page region; narrows extraction before comparison. */
    contentSelector: z
      .string()
      .trim()
      .min(1)
      .max(INPUT_LIMITS.maxSelectorChars)
      .optional()
      .describe('Optional CSS selector for the page region to compare.'),
    /** CSS selectors for page regions to exclude, such as menus or footers. */
    ignoreSelectors: z
      .array(z.string().trim().min(1).max(INPUT_LIMITS.maxSelectorChars))
      .max(INPUT_LIMITS.maxSelectors)
      .default([])
      .describe('CSS selectors for regions excluded from extraction, such as menus or footers.'),
  })
  .strict();

export type MonitorSource = z.infer<typeof sourceSchema>;

export function normalizedSourceUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('UNSAFE_URL_SCHEME');
  if (url.username || url.password) throw new Error('UNSAFE_URL_CREDENTIALS');
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))
    url.port = '';
  return url.toString();
}

/**
 * Topics the operator cares about. These are relevance interests, not filters or
 * guaranteed change types. The workflow sends their meanings, organizationContext,
 * prioritySignals, and ignoredSignals with each before/after excerpt to Jev.
 * Jev's change-type and relevance criteria are in lib/classification.ts.
 */
const interestValues = [
  'pricing',
  'packaging',
  'product_feature',
  'availability',
  'deprecation',
  'policy_terms',
  'security_compliance',
  'documentation',
  'company_announcement',
] as const;

export type MonitorInterest = (typeof interestValues)[number];

/** Meanings sent to Jev with selected interests; edit these to customize the taxonomy. */
export const INTEREST_DEFINITIONS = {
  pricing: 'Prices, rates, discounts, billing units, and monetary charges.',
  packaging: 'Plan or tier contents, entitlements, limits, bundles, and plan boundaries.',
  product_feature: 'Product capabilities that are added, removed, or materially changed.',
  availability: 'Where or to whom a product or service is available, including region and access.',
  deprecation: 'Retirement or removal of a feature, API, plan, or service.',
  policy_terms: 'Contractual, privacy, support, or other policy terms.',
  security_compliance: 'Security controls, certifications, audits, and compliance commitments.',
  documentation: 'Documentation-only changes without a clear product or commercial change.',
  company_announcement: 'Company news without a direct product or commercial change.',
} satisfies Record<MonitorInterest, string>;

export const interestSchema = z.enum(interestValues).describe(
  `Relevance interests: ${Object.entries(INTEREST_DEFINITIONS)
    .map(([value, meaning]) => `${value} = ${meaning}`)
    .join(' ')}`,
);

/**
 * baseline creates missing snapshots and does not compare existing ones or classify pending changes.
 * manual also creates missing snapshots, then compares and classifies on later runs, without notifications.
 * scheduled compares and classifies like manual, then notifies enabled providers for new changes.
 */
export const runModeSchema = z
  .enum(['baseline', 'manual', 'scheduled'])
  .default('manual')
  .describe(
    'baseline = capture missing baselines only; manual = compare/classify without notifications; scheduled = compare/classify and deliver pending decision notifications, including recovered changes.',
  );

const boundedProbability = z.number().finite().min(RUBRIC.minProbability).max(RUBRIC.maxProbability);
const boundedScore = z.number().finite().min(RUBRIC.minScore).max(RUBRIC.maxScore);

export const monitorInputSchema = z
  .object({
    /** Stable competitor identity; each monitorId has independent source history. */
    monitorId: identifier.describe('Stable competitor/monitor ID used to retrieve prior snapshots.'),
    /** Run behavior; see runModeSchema above for baseline, manual, and scheduled. */
    runMode: runModeSchema,
    /** Operator context used when Jev scores the relevance of each detected change. */
    profile: z
      .object({
        /** Human-readable name for the company or product being monitored. */
        name: z.string().trim().min(1).max(INPUT_LIMITS.maxLabelChars).describe('Name shown for this monitor.'),
        /** Your team's market, product, or business context, passed to Jev as free text. */
        organizationContext: z
          .string()
          .trim()
          .max(INPUT_LIMITS.maxOrganizationContextChars)
          .optional()
          .describe('Optional operator context passed to Jev when judging relevance and impact.'),
        /** Relevance topics; their explicit meanings are in INTEREST_DEFINITIONS above. */
        interests: z
          .array(interestSchema)
          .min(1)
          .max(INPUT_LIMITS.maxInterests)
          .describe('Topics to prioritize when Jev scores relevance; select at least one.'),
        /** Free-text hints for especially important changes; these inform Jev, not a hard filter. */
        prioritySignals: z
          .array(z.string().trim().min(1).max(INPUT_LIMITS.maxSelectorChars))
          .max(INPUT_LIMITS.maxSignals)
          .default([])
          .describe('Free-text priority hints sent to Jev; they do not guarantee an alert.'),
        /** Free-text hints for low-value changes; these inform Jev, not a hard exclusion. */
        ignoredSignals: z
          .array(z.string().trim().min(1).max(INPUT_LIMITS.maxSelectorChars))
          .max(INPUT_LIMITS.maxSignals)
          .default([])
          .describe('Free-text low-value hints sent to Jev; they do not remove evidence.'),
      })
      .strict()
      .describe('Operator profile used to judge relevance; values are passed to Jev with each candidate.'),
    /** Public pages to collect; the active limit defaults to three and can be configured. */
    sources: z
      .array(sourceSchema)
      .min(1)
      .max(SOURCE_LIMITS.maxSources)
      .describe('Public pages to monitor; deployment MAX_SOURCES defaults to 3.'),
    /** Optional deterministic thresholds and resource limits applied after Jev answers. */
    policy: z
      .object({
        /** Probability (0–1) at which a change counts as substantive for routing. */
        minimumSubstantiveProbability: boundedProbability
          .default(POLICY_DEFAULTS.minimumSubstantiveProbability)
          .describe('Minimum Jev probability (0–1) to treat a change as substantive.'),
        /** Probability (0–1) at which a change counts as breaking for routing. */
        minimumBreakingProbability: boundedProbability
          .default(POLICY_DEFAULTS.minimumBreakingProbability)
          .describe('Minimum Jev probability (0–1) to treat a change as breaking.'),
        /** Minimum Jev confidence (0–1) in the change-type choice; lower confidence requests review. */
        minimumChoiceConfidence: boundedProbability
          .default(POLICY_DEFAULTS.minimumChoiceConfidence)
          .describe('Minimum change-type confidence (0–1); lower confidence routes to review.'),
        /** Minimum Jev confidence (0–1) in relevance and impact scores; lower values request review. */
        minimumScoreConfidence: boundedProbability
          .default(POLICY_DEFAULTS.minimumScoreConfidence)
          .describe('Minimum relevance/impact score confidence (0–1); lower confidence routes to review.'),
        /** Lowest relevance score (0–4) eligible for an alert. */
        alertFromRelevanceLevel: boundedScore
          .default(POLICY_DEFAULTS.alertFromRelevanceLevel)
          .describe('Minimum Jev relevance score (0–4) eligible for an alert.'),
        /** Lowest business-impact score (0–4) eligible for a substantive alert. */
        alertFromImpactLevel: boundedScore
          .default(POLICY_DEFAULTS.alertFromImpactLevel)
          .describe('Minimum Jev business-impact score (0–4) for a substantive alert.'),
        /** Maximum extracted change candidates processed from each source in one run. */
        maxCandidatesPerSource: z
          .number()
          .int()
          .min(1)
          .max(SOURCE_LIMITS.maxCandidatesPerSource)
          .optional()
          .describe('Maximum change candidates processed per source in one run.'),
        /** Maximum source pages fetched concurrently for this monitor. */
        sourceConcurrency: z
          .number()
          .int()
          .min(1)
          .max(SOURCE_LIMITS.maxConcurrency)
          .optional()
          .describe('Maximum source pages collected concurrently.'),
      })
      .partial()
      .default({})
      .describe('Optional routing thresholds and per-run resource limits.'),
    /** Optional presentation settings for the returned report. */
    options: z
      .object({
        /** Include a generated summary in the report when summary generation is available. */
        generateSummary: z.boolean().default(true).describe('Whether to generate a report summary.'),
        /** Include sources without changes in the report output. */
        includeUnchangedSources: z
          .boolean()
          .default(false)
          .describe('Whether the report lists sources with no detected change.'),
      })
      .partial()
      .default({})
      .describe('Optional report presentation settings.'),
  })
  .strict()
  .superRefine((input, context) => {
    const sourceIds = new Set<string>();
    const normalizedUrls = new Map<string, MonitorSource>();
    for (const [index, source] of input.sources.entries()) {
      if (sourceIds.has(source.id)) {
        context.addIssue({
          code: 'custom',
          path: ['sources', index, 'id'],
          message: `DUPLICATE_SOURCE_ID:${source.id}`,
        });
      }
      sourceIds.add(source.id);
      let normalized: string;
      try {
        normalized = normalizedSourceUrl(source.url);
      } catch {
        // The URL field already reports invalid input; do not throw from cross-field validation.
        continue;
      }
      const previous = normalizedUrls.get(normalized);
      if (previous) {
        const sameConfiguration =
          previous.fetchMode === source.fetchMode &&
          previous.minContentChars === source.minContentChars &&
          previous.contentSelector === source.contentSelector &&
          JSON.stringify(previous.ignoreSelectors) === JSON.stringify(source.ignoreSelectors);
        if (!sameConfiguration) {
          context.addIssue({
            code: 'custom',
            path: ['sources', index],
            message: `DUPLICATE_SOURCE_CONFLICT:${source.id}`,
          });
        }
      } else normalizedUrls.set(normalized, source);
    }
  })
  .transform(input => {
    const seen = new Set<string>();
    return {
      ...input,
      sources: input.sources.filter(source => {
        const normalized = normalizedSourceUrl(source.url);
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      }),
    };
  });

export type MonitorInput = z.infer<typeof monitorInputSchema>;

export function validateMonitorInput(value: unknown): MonitorInput {
  return monitorInputSchema.parse(value);
}
