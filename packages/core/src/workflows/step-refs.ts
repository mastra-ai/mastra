import { MISSING, normalizePredicatePath } from '../predicate';
import type { PathOrLiteral, Predicate } from '../predicate';
import { collectTemplateStepIds } from './mapping-template';
import type { MappingConfig } from './types';

/**
 * Declarative readers (`.map()` configs, templates, predicates) list the steps
 * they read up front, then resolve them with `getStepResultAsync` before
 * evaluating anything. That keeps them off the sync `getStepResult`, which
 * can't serve runs whose step results aren't all in memory.
 */

/** Id of a `{ step }` mapping source: a step id string or a step-like object. */
export function stepRefId(step: unknown): string | undefined {
  if (typeof step === 'string') return step;
  const id = (step as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' && id ? id : undefined;
}

const mappingRefsCache = new WeakMap<MappingConfig, string[]>();

/**
 * Step ids an object mapping config reads: `{ step }` sources (including every
 * arm of an array) and `${stepResults.<id>}` template placeholders. `value`,
 * `fn`, `requestContextPath` and `initData` sources read no step results.
 * Checks run in the same order `runMappingEntry` applies them.
 */
export function collectMappingStepRefs(mapConfig: MappingConfig): string[] {
  const cached = mappingRefsCache.get(mapConfig);
  if (cached) return cached;

  const ids = new Set<string>();
  for (const mapping of Object.values(mapConfig)) {
    const m: any = mapping;
    if (m === null || typeof m !== 'object') continue;
    if (m.value !== undefined || m.fn !== undefined) continue;
    if (typeof m.template === 'string') {
      collectTemplateStepIds(m.template).forEach(id => ids.add(id));
      continue;
    }
    if (m.requestContextPath || m.initData) continue;
    for (const step of Array.isArray(m.step) ? m.step : [m.step]) {
      const id = stepRefId(step);
      if (id) ids.add(id);
    }
  }

  const refs = [...ids];
  mappingRefsCache.set(mapConfig, refs);
  return refs;
}

/** Step ids a predicate reads through `stepResults.<id>` paths. */
export function collectPredicateStepRefs(predicate: Predicate): string[] {
  const ids = new Set<string>();
  const addPath = (rawPath: string) => {
    const path = normalizePredicatePath(rawPath);
    if (path === MISSING || !path.startsWith('stepResults.')) return;
    const rest = path.slice('stepResults.'.length);
    const dot = rest.indexOf('.');
    const id = dot === -1 ? rest : rest.slice(0, dot);
    if (id) ids.add(id);
  };
  const addRef = (ref: PathOrLiteral) => {
    if ('path' in ref) addPath(ref.path);
  };
  const visit = (p: Predicate) => {
    switch (p.op) {
      case 'and':
      case 'or':
        p.args.forEach(visit);
        break;
      case 'not':
        visit(p.arg);
        break;
      case 'exists':
      case 'notExists':
        addPath(p.path);
        break;
      case 'truthy':
      case 'falsy':
      case 'in':
      case 'notIn':
        addRef(p.value);
        break;
      default:
        addRef(p.left);
        addRef(p.right);
    }
  };
  visit(predicate);
  return [...ids];
}

/**
 * Resolves step ids to their outputs in one batch. Values match
 * `getStepResultAsync`: the output of a successful step, `null` otherwise.
 */
export async function resolveStepOutputs(
  ids: readonly string[],
  getStepResultAsync: (stepId: string) => Promise<unknown>,
): Promise<Map<string, unknown>> {
  const outputs = await Promise.all(ids.map(id => getStepResultAsync(id)));
  return new Map(ids.map((id, i) => [id, outputs[i]]));
}
