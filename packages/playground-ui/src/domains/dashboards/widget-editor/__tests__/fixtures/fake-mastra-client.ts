import type { MastraClient } from '@mastra/client-js';

/** The client methods the widget editor's preview and discovery call. */
type Method =
  | 'listScores'
  | 'getMetricAggregate'
  | 'getMetricBreakdown'
  | 'getMetricTimeSeries'
  | 'getMetricPercentiles'
  | 'getScoreAggregate'
  | 'getScoreBreakdown'
  | 'getScoreTimeSeries';

export type FakeMastraClient = Pick<MastraClient, Method>;

type Args<M extends Method> = Parameters<MastraClient[M]>[0];
type Answer<M extends Method> = Awaited<ReturnType<MastraClient[M]>>;

export const FAKE_SCORERS = [
  { scorerId: 'answer-relevancy', scorerName: 'Answer relevancy' },
  { scorerId: 'faithfulness', scorerName: 'Faithfulness' },
  { scorerId: 'toxicity', scorerName: 'Toxicity' },
];

/** The values each dimension takes, busiest first. */
const DIMENSION_VALUES: Record<string, string[]> = {
  entityName: ['support-agent', 'research-agent', 'billing-workflow', 'weather-tool', 'summarize-tool'],
  environment: ['production', 'staging', 'development'],
  serviceName: ['api', 'worker', 'scheduler'],
  model: ['gpt-4o', 'claude-sonnet-4-5', 'gemini-2.5-pro', 'gpt-4o-mini'],
  provider: ['openai', 'anthropic', 'google'],
  resourceId: ['acme-corp', 'globex', 'initech', 'umbrella'],
  threadId: ['thread-1042', 'thread-1043', 'thread-1051', 'thread-1077'],
  userId: ['ada', 'grace', 'linus', 'margaret'],
  status: ['ok', 'error'],
};

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '1d': 86_400_000,
};

const COST_PER_TOKEN = 0.000_003;

/** A deterministic number in [0, 1) for a key, so every render draws the same chart. */
function noise(key: string) {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** A metric's typical value per bucket, by what it measures and how it's aggregated. */
function magnitude(names: readonly string[], aggregation: string | undefined) {
  const name = names.join(',');
  if (name.includes('tokens')) return 18_000;
  if (aggregation === 'count') return 40;
  return 900;
}

type Filters = Record<string, unknown> & { timestamp?: { start?: Date | string; end?: Date | string } };

function windowOf(filters: Filters | undefined) {
  const end = new Date(filters?.timestamp?.end ?? Date.now()).getTime();
  const start = new Date(filters?.timestamp?.start ?? end - 86_400_000).getTime();
  return { start, end };
}

function buckets(filters: Filters | undefined, interval: string | undefined) {
  const { start, end } = windowOf(filters);
  const step = INTERVAL_MS[interval ?? '1h'] ?? 3_600_000;
  const out: Date[] = [];
  for (let t = Math.floor(start / step) * step; t <= end; t += step) out.push(new Date(t));
  return out;
}

/** Each group of `groupBy`, narrowed by the filters on those dimensions; one empty group when ungrouped. */
function groupsOf(groupBy: readonly string[] | undefined, filters: Filters | undefined) {
  if (!groupBy?.length) return [{}] as Record<string, string>[];
  return groupBy.reduce<Record<string, string>[]>(
    (acc, dimension) => {
      const pinned = filters?.[dimension];
      const values = typeof pinned === 'string' ? [pinned] : (DIMENSION_VALUES[dimension] ?? ['unknown']);
      return acc.flatMap(group => values.map(value => ({ ...group, [dimension]: value })));
    },
    [{}],
  );
}

const groupKey = (group: Record<string, string>) => Object.values(group).join('|');

/** How much of the traffic a group gets: busiest values first, errors a small share. */
function weight(group: Record<string, string>) {
  return Object.entries(group).reduce((w, [dimension, value]) => {
    if (dimension === 'status') return w * (value === 'error' ? 0.06 : 0.94);
    const index = DIMENSION_VALUES[dimension]?.indexOf(value) ?? 0;
    return w / (index + 1.4);
  }, 1);
}

function pointValue(seed: string, base: number, at: number, i: number) {
  const wave = 1 + 0.3 * Math.sin(i / 3 + noise(seed) * 6);
  return base * wave * (0.7 + 0.6 * noise(`${seed}:${at}`));
}

function scoreValue(seed: string) {
  return Math.round((0.55 + 0.4 * noise(seed)) * 1000) / 1000;
}

function compared(value: number, seed: string, compare: boolean) {
  if (!compare) return { value };
  const previousValue = value * (0.75 + 0.5 * noise(`${seed}:previous`));
  return { value, previousValue, changePercent: ((value - previousValue) / previousValue) * 100 };
}

/** A fake client answering the editor's requests with deterministic data derived from their args. */
export function createFakeMastraClient(): FakeMastraClient {
  return {
    async listScores(_args?: Args<'listScores'>) {
      const now = new Date().toISOString();
      const scores = FAKE_SCORERS.flatMap(({ scorerId, scorerName }) =>
        [0, 1, 2].map(i => ({ scorerId, scorerName, score: scoreValue(`${scorerId}:${i}`), timestamp: now })),
      );
      return {
        scores,
        pagination: { total: scores.length, page: 0, perPage: 100, hasMore: false },
      };
    },

    async getMetricAggregate(args: Args<'getMetricAggregate'>) {
      const seed = `${args.name.join(',')}:${args.aggregation}:${JSON.stringify(args.filters ?? {})}`;
      const hours = buckets(args.filters, '1h').length;
      const base = magnitude(args.name, args.aggregation);
      const value = args.aggregation === 'sum' || args.aggregation === 'count' ? base * hours : base;
      const figures = compared(value * (0.8 + 0.4 * noise(seed)), seed, args.comparePeriod !== undefined);
      return {
        ...figures,
        estimatedCost: figures.value * COST_PER_TOKEN,
        previousEstimatedCost: figures.previousValue === undefined ? undefined : figures.previousValue * COST_PER_TOKEN,
        costUnit: 'usd',
      };
    },

    async getMetricBreakdown(args: Args<'getMetricBreakdown'>) {
      const filters = args.filters as Filters;
      const hours = buckets(filters, '1h').length;
      const base = magnitude(args.name, args.aggregation);
      const additive = args.aggregation === 'sum' || args.aggregation === 'count';
      const groups = groupsOf(args.groupBy, filters).map(group => {
        const seed = `${args.name.join(',')}:${args.aggregation}:${groupKey(group)}`;
        const value = (additive ? base * hours * weight(group) : base) * (0.8 + 0.4 * noise(seed));
        return { dimensions: group, value, estimatedCost: value * COST_PER_TOKEN, costUnit: 'usd' };
      });
      groups.sort((a, b) => (args.orderDirection === 'ASC' ? a.value - b.value : b.value - a.value));
      return { groups: groups.slice(0, args.limit ?? groups.length) };
    },

    async getMetricTimeSeries(args: Args<'getMetricTimeSeries'>) {
      const filters = args.filters as Filters;
      const base = magnitude(args.name, args.aggregation);
      const additive = args.aggregation === 'sum' || args.aggregation === 'count';
      const series = groupsOf(args.groupBy, filters).map(group => {
        const key = args.groupBy?.length ? groupKey(group) : args.name.join(',');
        const seed = `${args.name.join(',')}:${args.aggregation}:${key}`;
        const scale = additive ? base * weight(group) : base;
        const points = buckets(filters, args.interval).map((at, i) => {
          const value = pointValue(seed, scale, at.getTime(), i);
          return { timestamp: at.toISOString(), value, estimatedCost: value * COST_PER_TOKEN };
        });
        return { name: key, costUnit: 'usd', points };
      });
      return { series };
    },

    async getMetricPercentiles(args: Args<'getMetricPercentiles'>) {
      const filters = args.filters as Filters;
      const base = magnitude([args.name], undefined);
      const series = args.percentiles.map(percentile => ({
        percentile,
        points: buckets(filters, args.interval).map((at, i) => ({
          timestamp: at.toISOString(),
          value: pointValue(`${args.name}:p${percentile}`, base * (0.5 + percentile * 1.6), at.getTime(), i),
        })),
      }));
      return { series };
    },

    async getScoreAggregate(args: Args<'getScoreAggregate'>) {
      const seed = `${String(args.scorerId)}:${JSON.stringify(args.filters ?? {})}`;
      return compared(scoreValue(seed), seed, args.comparePeriod !== undefined);
    },

    async getScoreBreakdown(args: Args<'getScoreBreakdown'>) {
      const groups = groupsOf(args.groupBy, args.filters as Filters).map(group => ({
        dimensions: group,
        value: args.aggregation === 'count' ? Math.round(200 * weight(group)) : scoreValue(groupKey(group)),
      }));
      return { groups };
    },

    async getScoreTimeSeries(args: Args<'getScoreTimeSeries'>) {
      const filters = args.filters as Filters;
      const scorerId = String(args.scorerId);
      const series = groupsOf(args.groupBy, filters).map(group => {
        const name = args.groupBy?.length ? groupKey(group) : scorerId;
        const points = buckets(filters, args.interval).map((at, i) => ({
          timestamp: at.toISOString(),
          value: Math.min(1, pointValue(`${scorerId}:${name}`, scoreValue(name), at.getTime(), i)),
        }));
        return { name, points };
      });
      return { series };
    },
  };
}
