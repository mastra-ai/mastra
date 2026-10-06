/**
 * Extra per-project literals for trace-query cases, discovered with aggregate-only
 * `GROUP BY … ORDER BY count() DESC LIMIT 1` reads (the same pattern as OBS-539's profile).
 * Values live only in a 0600 sidecar outside the repo, keyed by project hash, and are registered
 * for redaction and leak-check. `selection.json` is never modified.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CACHE_DIR, registerSensitive } from '../shared/env';
import { SIDECAR_SUFFIX } from '../shared/leak-check';
import type { LiteralSidecar } from '../shared/leak-check';
import type { ProfileContext, SelectedProject, Selection } from '../shared/profile';
import { SIDECAR_KEYS, SPAN_TYPE } from './cases';
import type { SidecarKey, TraceQueryLiterals } from './cases';

export const SIDECAR_FILE = join(CACHE_DIR, `trace-query${SIDECAR_SUFFIX}`);

const SCOPE = 'organizationId = {o:String} AND projectId = {p:String}';
const ROOTS = `${SCOPE} AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}`;
const SPANS = `${SCOPE} AND endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}`;
const FEEDBACK = `${SCOPE} AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp < {to:DateTime64(3, 'UTC')}`;

/** `k` = discovered metadata key, `et` = discovered entityType; both bound, never inlined. */
export const SIDECAR_SQL: Record<SidecarKey, string> = {
  metadataValue: `SELECT metadataSearch[{k:String}] AS v FROM mastra_trace_roots WHERE ${ROOTS} AND mapContains(metadataSearch, {k:String}) AND v != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  tag: `SELECT t AS v FROM mastra_trace_roots ARRAY JOIN tags AS t WHERE ${ROOTS} AND t != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  model: `SELECT JSONExtractString(attributes, 'model') AS v FROM mastra_span_events WHERE ${SPANS} AND spanType = '${SPAN_TYPE}' AND JSONType(attributes, 'model') = 'String' AND v != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  entityName: `SELECT entityName AS v FROM mastra_trace_roots WHERE ${ROOTS} AND entityType = {et:String} AND entityName IS NOT NULL AND entityName != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  feedbackType: `SELECT feedbackType AS v FROM mastra_feedback_events WHERE ${FEEDBACK} AND feedbackType != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
};

export type Sidecar = LiteralSidecar & { discoveredAt?: string; anchorTo?: string };

export function loadSidecar(file = SIDECAR_FILE): Sidecar | undefined {
  if (!existsSync(file)) return undefined;
  const sidecar = JSON.parse(readFileSync(file, 'utf8')) as Sidecar;
  for (const values of Object.values(sidecar.projects)) {
    registerSensitive(Object.values(values).filter((v): v is string => typeof v === 'string' && v !== ''));
  }
  return sidecar;
}

export function saveSidecar(sidecar: Sidecar, file = SIDECAR_FILE): void {
  mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify(sidecar, null, 2), { mode: 0o600 });
  chmodSync(file, 0o600);
}

/** Merges a project's OBS-539 literals with its sidecar values (null = not discovered). */
export function literalsFor(project: SelectedProject, sidecar: Sidecar | undefined): TraceQueryLiterals {
  const extra = sidecar?.projects[project.hash] ?? {};
  const pick = (key: SidecarKey) =>
    typeof extra[key] === 'string' && extra[key] !== '' ? (extra[key] as string) : null;
  return {
    ...project.literals,
    metadataValue: project.literalSource.metadataKey === 'discovered' ? pick('metadataValue') : null,
    tag: pick('tag'),
    model: pick('model'),
    entityName: pick('entityName'),
    feedbackType: pick('feedbackType'),
  };
}

const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

export async function discoverSidecar(ctx: ProfileContext, selection: Selection, days = 7): Promise<Sidecar> {
  const to = new Date(selection.anchorTo);
  const window = { from: chTime(new Date(to.getTime() - days * 86_400_000)), to: chTime(to) };
  const sidecar: Sidecar = {
    version: 1,
    projects: {},
    discoveredAt: new Date().toISOString(),
    anchorTo: selection.anchorTo,
  };
  for (const project of selection.projects) {
    const values: Record<string, string | null> = {};
    for (const key of SIDECAR_KEYS) {
      if (key === 'metadataValue' && project.literalSource.metadataKey !== 'discovered') {
        values[key] = null;
        continue;
      }
      const params = {
        ...window,
        o: project.organizationId,
        p: project.projectId,
        k: project.literals.metadataKey,
        et: project.literals.entityType,
      };
      await ctx.pause();
      const outcome = await ctx.client.rows<{ v: string }>(SIDECAR_SQL[key], params, {
        tier: ctx.tier,
        logComment: ctx.logComment(`discover-${key}:${project.bucket}:${project.hash}`),
        settings: { max_execution_time: 60, max_result_rows: '10' },
      });
      if (!outcome.ok) {
        throw new Error(
          `Discovery ${key} failed on ${project.bucket}:${project.hash} (code ${outcome.errorCode ?? '?'})`,
        );
      }
      const value = outcome.rows?.[0]?.v || null;
      if (value) registerSensitive([value]);
      values[key] = value;
    }
    sidecar.projects[project.hash] = values;
  }
  return sidecar;
}

/** Shareable view: which literals were found per project, never the values. */
export function publicSidecar(sidecar: Sidecar, selection: Selection) {
  return selection.projects.map(p => ({
    bucket: p.bucket,
    hash: p.hash,
    found: SIDECAR_KEYS.filter(k => typeof sidecar.projects[p.hash]?.[k] === 'string'),
  }));
}
