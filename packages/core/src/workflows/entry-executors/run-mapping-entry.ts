import { resolveTemplate, traverseMappingPath } from '../mapping-template';
import { collectMappingStepRefs, resolveStepOutputs, stepRefId } from '../step-refs';
import type { MappingStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

/**
 * Runs a declarative `mapping` entry. Function configs are invoked directly;
 * object configs are interpreted key-by-key (`value` / `fn` / `template` /
 * `requestContextPath` / `step`+`path` / `initData`+`path`).
 *
 * Object configs resolve every step they read up front, so no key evaluation
 * goes through the sync `getStepResult`.
 */
export async function runMappingEntry(entry: MappingStepEntry, ctx: EntryExecuteContext): Promise<unknown> {
  const { mapConfig } = entry;
  if (typeof mapConfig === 'function') {
    return mapConfig(ctx);
  }

  const { getInitData, requestContext } = ctx;
  const stepOutputs = await resolveStepOutputs(collectMappingStepRefs(mapConfig), id => ctx.getStepResultAsync(id));
  // Same contract as getStepResult: the step's output when it succeeded, null otherwise.
  const outputOf = (step: unknown): unknown => {
    const id = stepRefId(step);
    return id !== undefined && stepOutputs.has(id) ? stepOutputs.get(id) : null;
  };

  const result: Record<string, any> = {};
  for (const [key, mapping] of Object.entries(mapConfig)) {
    const m: any = mapping;

    if (m.value !== undefined) {
      result[key] = m.value;
      continue;
    }

    if (m.fn !== undefined) {
      result[key] = await m.fn(ctx);
      continue;
    }

    if (typeof m.template === 'string') {
      result[key] = resolveTemplate(m.template, ctx, stepOutputs);
      continue;
    }

    if (m.requestContextPath) {
      result[key] = requestContext.get(m.requestContextPath);
      continue;
    }

    const stepResult = m.initData
      ? getInitData()
      : outputOf(
          Array.isArray(m.step)
            ? // An arm resolves to null when it did not run successfully, and to its
              // real output (including {}, 0, false, '') when it did. So `!== null`
              // is the correct "which arm executed" test; a truthiness/emptiness
              // check drops valid falsy outputs. See #20894.
              m.step.find((s: any) => outputOf(s) !== null)
            : m.step,
        );

    result[key] = traverseMappingPath(stepResult, m.path, describeMappingSource(m));
  }
  return result;
}

/** Human-readable source label for path-traversal errors. */
function describeMappingSource(m: any): string {
  if (m.initData) return 'initData';
  const stepLabel = (s: any): string => (typeof s === 'string' ? s : (s?.id ?? 'unknown'));
  if (Array.isArray(m.step)) return `step ${m.step.map(stepLabel).join('|')}`;
  return `step ${stepLabel(m.step)}`;
}
