import { createDirectiveRegistry, resolveElementProps } from '@json-render/core';
import type { Spec } from '@json-render/core';
import type { GenUIDefinition } from './definition';
import { checkSpecStructure, propContexts } from './spec';
import { validateModelInput } from './validate';
import type { GenUIValidationResult } from './validate';

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUISpecValidator {
  /** Validates props against a component's schema; `undefined` when the component is not in the definition. */
  validateProps(type: string, props: unknown): GenUIValidationResult<unknown> | undefined;
  /** First problem of a complete spec: structure, unknown components and invalid props. */
  checkSpec(spec: Spec): string | undefined;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks specs against a definition's components. Props results are cached per props object, so re-checking
 * the same spec while it renders is free.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createSpecValidator(definition: GenUIDefinition): GenUISpecValidator {
  const propsValidation = new WeakMap<object, Map<string, GenUIValidationResult<unknown>>>();
  const validateProps = (type: string, props: unknown) => {
    const entry = definition.components[type];
    if (!entry) return undefined;
    const key = isRecord(props) ? props : undefined;
    const cached = key && propsValidation.get(key)?.get(type);
    if (cached) return cached;
    const result = validateModelInput(entry.props, props ?? {});
    if (key) {
      const byType = propsValidation.get(key) ?? new Map();
      byType.set(type, result);
      propsValidation.set(key, byType);
    }
    return result;
  };

  const directiveRegistry = createDirectiveRegistry(definition.directives);
  const checkSpec = (spec: Spec): string | undefined => {
    const structural = checkSpecStructure(spec);
    if (structural) return structural;
    const contexts = propContexts(spec, {
      stateModel: spec.state ?? {},
      functions: definition.functions,
      directives: directiveRegistry,
    });
    for (const [id, element] of Object.entries(spec.elements)) {
      const entry = definition.components[element.type];
      if (!entry?.declarative) return `unknown component "${element.type}" on element "${id}"`;
      const context = contexts.get(id);
      if (!context) continue;
      const validation = validateProps(element.type, resolveElementProps(element.props, context));
      if (validation && !validation.ok) {
        return `invalid props for element "${id}" (${element.type}): ${validation.error}`;
      }
    }
    return undefined;
  };

  return { validateProps, checkSpec };
}
