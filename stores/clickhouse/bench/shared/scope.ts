/**
 * Post-compile SQL rewrites: project scoping (always) and the labelled what-if variants.
 *
 * Every rewrite asserts how many times its pattern matched and fails closed otherwise, so a
 * compiler change cannot silently produce an unscoped or unmodified benchmark query.
 */
import type { CompiledClickHouseTraceQuery } from '../../src/storage/domains/observability/v-next/trace-query';

export const PROJECT_PARAM = 'bench_project_id';
export const ORG_PARAM = 'bench_org_id';

export type Relation = 'spans' | 'scores' | 'feedback';

const RELATION_CTE: Record<Relation, string> = {
  spans: 'current_spans AS (',
  scores: 'current_scores AS (',
  feedback: 'current_feedback AS (',
};

const TENANT_FRAGMENT = /AND organizationId = (\{trace_query_\d+:String\})/g;

export class RewriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RewriteError';
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/**
 * Adds `AND projectId = {bench_project_id:String}` after every tenant fragment the compiler emitted.
 * Expected fragments: the roots seed, `root_scope`, the current-root key re-read when the compiler
 * uses one (`queryTraces()`), and one per related collection.
 */
export function injectProjectScope<T extends CompiledClickHouseTraceQuery>(
  compiled: T,
  projectId: string,
  relations: readonly Relation[],
): T {
  for (const relation of ['spans', 'scores', 'feedback'] as const) {
    const present = countOccurrences(compiled.query, RELATION_CTE[relation]);
    const declared = relations.includes(relation) ? 1 : 0;
    if (present !== declared) {
      throw new RewriteError(`Relation ${relation}: expected ${declared} CTE(s), found ${present}`);
    }
  }
  // The compiler at b123b235d9a (usable as a `--legacy` arm) read current-root keys in a CTE of their own.
  const keyed = countOccurrences(compiled.query, 'current_root_keys AS (');
  if (keyed > 1) throw new RewriteError(`Expected at most one current_root_keys CTE, found ${keyed}`);
  // queryTraces() also seeds the delta index and span existence checks with the tenant's window roots.
  const windows = countOccurrences(compiled.query, 'FROM mastra_trace_roots w\n');
  if (windows > 2) throw new RewriteError(`Expected at most two window-root seeds, found ${windows}`);
  // A Platform-style delta index filtered by its own tenant columns (QX15) is one more scoped scan.
  const deltaIndex = countOccurrences(
    compiled.query,
    'FROM mastra_trace_roots_delta\n    WHERE /* tenant-scoped delta */',
  );
  // A span-name index lookup (QX17) is one more scoped scan per use.
  const nameIndex = countOccurrences(compiled.query, 'FROM mastra_trace_span_names\n');
  // A narrow current-roots table (QX19) replaces the seed and the re-read with one scoped scan.
  const narrow = countOccurrences(compiled.query, 'FROM mastra_trace_current_roots\n') > 0 ? -1 : 0;
  // One root per trace (QX24): root_scope reads the window once, without a seed.
  const oneRoot = countOccurrences(compiled.query, 'FROM mastra_trace_roots r /* one root per trace */\n') > 0 ? -1 : 0;
  return addProjectAfterTenant(
    compiled,
    projectId,
    2 + keyed + windows + deltaIndex + nameIndex + narrow + oneRoot + relations.length,
  );
}

/** Adds the project to the `queryTraces()` payload lookup, which the compiler already tenant-scopes. */
export function injectPayloadProjectScope<T extends CompiledClickHouseTraceQuery>(compiled: T, projectId: string): T {
  if (!compiled.query.includes('metadataRaw AS metadata')) throw new RewriteError('Not a root payload lookup');
  return addProjectAfterTenant(compiled, projectId, 1);
}

function addProjectAfterTenant<T extends CompiledClickHouseTraceQuery>(
  compiled: T,
  projectId: string,
  expected: number,
): T {
  const tenantParams = new Set<string>();
  let matched = 0;
  const query = compiled.query.replace(TENANT_FRAGMENT, (fragment, param: string) => {
    matched++;
    tenantParams.add(param);
    return `${fragment} AND projectId = {${PROJECT_PARAM}:String}`;
  });
  if (matched !== expected) {
    throw new RewriteError(`Expected ${expected} tenant-scoped scans, found ${matched}`);
  }
  if (tenantParams.size !== 1) throw new RewriteError('Expected one shared tenant parameter');
  if (PROJECT_PARAM in compiled.query_params) throw new RewriteError('Project parameter name collides');
  return { ...compiled, query, query_params: { ...compiled.query_params, [PROJECT_PARAM]: projectId } };
}

/** Adds the org/project scope to the payload lookup used by `queryTraces()` page mode. */
export function scopePayloadQuery(
  compiled: CompiledClickHouseTraceQuery,
  organizationId: string,
  projectId: string,
): CompiledClickHouseTraceQuery {
  return replaceExactlyOnce(
    compiled,
    'WHERE (startedAt, traceId, spanId, endedAt) IN (',
    `WHERE organizationId = {${ORG_PARAM}:String} AND projectId = {${PROJECT_PARAM}:String} AND (startedAt, traceId, spanId, endedAt) IN (`,
    { [ORG_PARAM]: organizationId, [PROJECT_PARAM]: projectId },
  );
}

const SPAN_TENANT_FRAGMENT = /AND organizationId = (\{span_\d+:String\})/g;

/**
 * Adds `AND projectId = …` after both tenant fragments of a compiled querySpans() select
 * (`candidate_ids` and `candidates`), failing closed on any other count.
 */
export function injectSpanProjectScope<T extends { query: string; query_params: Record<string, unknown> }>(
  compiled: T,
  projectId: string,
): T {
  const tenantParams = new Set<string>();
  let matched = 0;
  const query = compiled.query.replace(SPAN_TENANT_FRAGMENT, (fragment, param: string) => {
    matched++;
    tenantParams.add(param);
    return `${fragment} AND projectId = {${PROJECT_PARAM}:String}`;
  });
  if (matched !== 2) throw new RewriteError(`Expected 2 tenant-scoped span scans, found ${matched}`);
  if (tenantParams.size !== 1) throw new RewriteError('Expected one shared span tenant parameter');
  if (PROJECT_PARAM in compiled.query_params) throw new RewriteError('Project parameter name collides');
  return { ...compiled, query, query_params: { ...compiled.query_params, [PROJECT_PARAM]: projectId } };
}

const FROM_PARAM = 'bench_from';

/**
 * What-if for querySpans() hydration (`span-payload-scoped` / `span-metrics-scoped`): add the
 * org/project sort-key prefix and, for the payload read, the partition bound (`endedAt >= from`,
 * which every selected span satisfies because the select stage prewheres on it).
 */
export function scopeSpanHydration<T extends { query: string; query_params: Record<string, unknown> }>(
  compiled: T,
  stage: 'payload' | 'metrics',
  scope: { organizationId: string; projectId: string; from?: string },
): T {
  const anchor = stage === 'payload' ? 'WHERE tuple(isNull(organizationId)' : 'WHERE (tuple(isNull(organizationId)';
  const head = `WHERE organizationId = {${ORG_PARAM}:String} AND projectId = {${PROJECT_PARAM}:String}`;
  const params: Record<string, string> = { [ORG_PARAM]: scope.organizationId, [PROJECT_PARAM]: scope.projectId };
  let bound = '';
  if (stage === 'payload') {
    if (!scope.from) throw new RewriteError('Payload scope needs the window start');
    bound = ` AND endedAt >= {${FROM_PARAM}:DateTime64(3, 'UTC')}`;
    params[FROM_PARAM] = scope.from.replace('T', ' ').replace(/Z$/, '');
  }
  const count = countOccurrences(compiled.query, anchor);
  if (count !== 1) throw new RewriteError(`Span ${stage} scope: expected one anchor, found ${count}`);
  for (const name of Object.keys(params)) {
    if (name in compiled.query_params) throw new RewriteError(`Parameter ${name} collides`);
  }
  return {
    ...compiled,
    query: compiled.query.replace(anchor, `${head}${bound} AND ${anchor.slice('WHERE '.length)}`),
    query_params: { ...compiled.query_params, ...params },
  };
}

export type Variant = 'base' | 'uniq' | 'exact' | 'w1';

/**
 * Applies a labelled what-if variant to an already project-scoped query.
 * - `uniq`: `uniqExact` → `uniq`
 * - `exact`: `quantileDeterministic(p)(durationMs, traceSeed)` → `quantileExact(p)(durationMs)`
 * - `w1`: tenant- and project-scope the outer `current_roots` re-read by `traceId`
 */
export function applyVariant(compiled: CompiledClickHouseTraceQuery, variant: Variant): CompiledClickHouseTraceQuery {
  switch (variant) {
    case 'base':
      return compiled;
    case 'uniq': {
      const count = countOccurrences(compiled.query, 'uniqExact(');
      if (count === 0) throw new RewriteError('Variant uniq: no uniqExact() to rewrite');
      return { ...compiled, query: compiled.query.split('uniqExact(').join('uniq(') };
    }
    case 'exact': {
      let count = 0;
      const query = compiled.query.replace(
        /quantileDeterministic\(([0-9.]+)\)\(durationMs, traceSeed\)/g,
        (_match, level: string) => {
          count++;
          return `quantileExact(${level})(durationMs)`;
        },
      );
      if (count === 0) throw new RewriteError('Variant exact: no quantileDeterministic() to rewrite');
      if (query.includes('quantileDeterministic')) throw new RewriteError('Variant exact: unrewritten quantile left');
      return { ...compiled, query };
    }
    case 'w1': {
      const tenantParam = /AND organizationId = (\{trace_query_\d+:String\}) AND projectId/.exec(compiled.query)?.[1];
      if (!tenantParam) throw new RewriteError('Variant w1: query is not project-scoped');
      const pattern = /(SELECT \*\s+FROM mastra_trace_roots\s+WHERE )(traceId IN \()/g;
      let count = 0;
      const query = compiled.query.replace(pattern, (_match, head: string, tail: string) => {
        count++;
        return `${head}organizationId = ${tenantParam} AND projectId = {${PROJECT_PARAM}:String} AND ${tail}`;
      });
      if (count !== 1) throw new RewriteError(`Variant w1: expected 1 outer current_roots read, found ${count}`);
      return { ...compiled, query };
    }
  }
}

function replaceExactlyOnce(
  compiled: CompiledClickHouseTraceQuery,
  needle: string,
  replacement: string,
  params: Record<string, string>,
): CompiledClickHouseTraceQuery {
  const count = countOccurrences(compiled.query, needle);
  if (count !== 1) throw new RewriteError(`Expected one occurrence of the rewrite anchor, found ${count}`);
  return {
    ...compiled,
    query: compiled.query.replace(needle, replacement),
    query_params: { ...compiled.query_params, ...params },
  };
}
