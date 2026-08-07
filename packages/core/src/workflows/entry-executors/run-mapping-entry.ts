import { resolveTemplate, traverseMappingPath } from '../mapping-template';
import type { MappingStepEntry } from '../types';
import type { EntryExecuteContext } from './types';

/**
 * Runs a declarative `mapping` entry. Function configs are invoked directly;
 * object configs are interpreted key-by-key (`value` / `fn` / `template` /
 * `requestContextPath` / `step`+`path` / `initData`+`path`).
 */
export async function runMappingEntry(entry: MappingStepEntry, ctx: EntryExecuteContext): Promise<unknown> {
  const { mapConfig } = entry;
  if (typeof mapConfig === 'function') {
    return mapConfig(ctx);
  }

  const { getStepResult, getInitData, requestContext } = ctx;

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
      result[key] = resolveTemplate(m.template, ctx);
      continue;
    }

    if (m.requestContextPath) {
      result[key] = requestContext.get(m.requestContextPath);
      continue;
    }

    const stepResult = m.initData
      ? getInitData()
      : getStepResult(
          Array.isArray(m.step)
            ? // getStepResult returns null for any arm that did not run successfully,
              // and the arm's real output (including {}, 0, false, '') for the one that
              // did. So `!== null` is the correct "which arm executed" test; a
              // truthiness/emptiness check drops valid falsy outputs. See #20894.
              m.step.find((s: any) => getStepResult(s) !== null)
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
