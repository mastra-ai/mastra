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
            ? m.step.find((s: any) => {
                const stepRes = getStepResult(s);
                if (typeof stepRes === 'object' && stepRes !== null) {
                  return Object.keys(stepRes).length > 0;
                }
                return stepRes;
              })
            : m.step,
        );

    result[key] = traverseMappingPath(stepResult, m.path, `step ${m?.step?.id ?? 'initData'}`);
  }
  return result;
}
