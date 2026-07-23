/**
 * The single home for stored `mapConfig` handling.
 *
 * A mapping entry's config crosses the storage boundary as a JSON string.
 * - {@link parseMapConfig} is the one parser (rehydration + validation both
 *   use it; rehydration via the throwing form).
 * - {@link analyzeMapConfig} is the one validator: it walks each descriptor,
 *   collects issues, and infers the mapping's output schema in the same pass
 *   (the two are inseparable — a descriptor's validity determines its
 *   contribution to the output shape).
 *
 * Template syntax checking delegates to `mapping-template.ts`'s
 * `validateTemplate` — the same parser the runtime uses — plus a scope check
 * over the placeholders' step ids.
 */
import { collectTemplateStepIds, validateTemplate } from '../mapping-template';
import type { JsonSchema } from './json-schema-to-zod';
import { isCanonicalMappingPath, isRecord, schemaAtPath, schemaForValue } from './validate/schema-utils';
import type { WorkflowValidationIssue } from './validate/types';

/** Parses a stored mapConfig JSON string; throws with the step id on malformed JSON. */
export function parseMapConfig(raw: string, stepId: string): Record<string, any> {
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch (e) {
    throw new Error(`Stored mapping step "${stepId}" has invalid JSON mapConfig: ${(e as Error).message}`);
  }
}

export interface MapConfigAnalysisOptions {
  /** Issue path prefix of the mapping entry, e.g. `graph.2`. */
  path: string;
  /** Outputs of preceding workflow-local steps (schema may be undefined when unknown). */
  availableOutputs: ReadonlyMap<string, JsonSchema | undefined>;
  /** The workflow's input schema (for `{ initData: true }` sources). */
  inputSchema: JsonSchema | undefined;
  /** The workflow's request-context schema (for `{ requestContextPath }` sources). */
  requestContextSchema: JsonSchema | undefined;
}

export interface MapConfigAnalysis {
  issues: WorkflowValidationIssue[];
  /** Inferred output schema of the mapping step; undefined when the config is unusable. */
  outputSchema: JsonSchema | undefined;
}

/**
 * Validates a mapping entry's raw `mapConfig` string and infers the step's
 * output schema. Every key must define exactly one source
 * (`value` | `template` | `requestContextPath` | `initData`/`step` + `path`);
 * step references must point at preceding workflow-local steps.
 */
export function analyzeMapConfig(rawConfig: string, opts: MapConfigAnalysisOptions): MapConfigAnalysis {
  const issues: WorkflowValidationIssue[] = [];
  const { path, availableOutputs } = opts;

  let config: unknown;
  try {
    config = JSON.parse(rawConfig);
  } catch {
    config = undefined;
  }
  if (!isRecord(config)) {
    issues.push({
      code: 'invalid-map-config',
      path: `${path}.mapConfig`,
      message: 'Mapping config must be a JSON object.',
    });
    return { issues, outputSchema: undefined };
  }

  const properties: Record<string, JsonSchema> = {};
  for (const [key, descriptor] of Object.entries(config)) {
    const descriptorPath = `${path}.mapConfig.${key}`;
    if (!isRecord(descriptor)) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Mapping descriptor must be an object.',
      });
      continue;
    }
    const forms = [
      'value' in descriptor,
      typeof descriptor.template === 'string',
      typeof descriptor.requestContextPath === 'string',
      'path' in descriptor,
    ].filter(Boolean).length;
    if (forms !== 1) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Mapping descriptor must define exactly one source.',
      });
      continue;
    }
    if ('value' in descriptor) {
      properties[key] = schemaForValue(descriptor.value);
      continue;
    }
    if (typeof descriptor.template === 'string') {
      let syntaxError: string | undefined;
      try {
        validateTemplate(descriptor.template);
      } catch (err) {
        syntaxError = (err as Error).message;
      }
      const unknownStep =
        syntaxError === undefined
          ? collectTemplateStepIds(descriptor.template).find(stepId => !availableOutputs.has(stepId))
          : undefined;
      if (syntaxError !== undefined || unknownStep !== undefined) {
        issues.push({
          code: 'invalid-map-reference',
          path: `${descriptorPath}.template`,
          message: syntaxError ?? 'Template references must use an available workflow-local source.',
        });
      }
      properties[key] = { type: 'string' };
      continue;
    }
    if (typeof descriptor.requestContextPath === 'string') {
      if (!isCanonicalMappingPath(descriptor.requestContextPath) || descriptor.requestContextPath === '') {
        issues.push({
          code: 'invalid-map-config',
          path: `${descriptorPath}.requestContextPath`,
          message: 'Mapping paths must use plain dotted segments.',
        });
      }
      properties[key] = schemaAtPath(opts.requestContextSchema, descriptor.requestContextPath) ?? {};
      continue;
    }

    if (typeof descriptor.path !== 'string' || !isCanonicalMappingPath(descriptor.path)) {
      issues.push({
        code: 'invalid-map-config',
        path: `${descriptorPath}.path`,
        message: 'Mapping paths must use plain dotted segments.',
      });
      continue;
    }
    const hasInitData = descriptor.initData === true;
    const stepIds =
      typeof descriptor.step === 'string' ? [descriptor.step] : Array.isArray(descriptor.step) ? descriptor.step : [];
    if (hasInitData === stepIds.length > 0 || stepIds.some(stepId => typeof stepId !== 'string')) {
      issues.push({
        code: 'invalid-map-config',
        path: descriptorPath,
        message: 'Path mappings must reference exactly one of initData or step.',
      });
      continue;
    }
    let sourceSchema: JsonSchema | undefined;
    if (hasInitData) {
      sourceSchema = opts.inputSchema;
    } else {
      const missing = stepIds.find(stepId => !availableOutputs.has(stepId));
      if (missing) {
        issues.push({
          code: 'invalid-map-reference',
          path: `${descriptorPath}.step`,
          message: `Mapping source "${missing}" must be a preceding workflow-local step.`,
        });
        continue;
      }
      sourceSchema = stepIds.map(stepId => availableOutputs.get(stepId)).find(Boolean);
    }
    const selectedSchema = schemaAtPath(sourceSchema, descriptor.path);
    if (sourceSchema && !selectedSchema) {
      issues.push({
        code: 'invalid-map-config',
        path: `${descriptorPath}.path`,
        message: `Path "${descriptor.path}" does not exist in the source schema.`,
      });
    }
    properties[key] = selectedSchema ?? {};
  }
  return { issues, outputSchema: { type: 'object', properties, required: Object.keys(config) } };
}
