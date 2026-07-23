/**
 * The `${scope.path}` mapping-template DSL used by `.map()` template sources.
 *
 * Definition-time syntax checks live in {@link validateTemplate}; run-time
 * resolution (path lookup + value coercion) lives in {@link resolveTemplate}.
 * This module has no knowledge of the step-entry union — it is a pure
 * string-DSL interpreter over a step's execute context.
 */

/** Walks a dotted path on an object. `''` or `'.'` returns the root unchanged. */
export function traverseMappingPath(root: unknown, path: string, errorLabel: string): unknown {
  if (path === '' || path === '.') return root;
  const parts = path.split('.');
  let value: any = root;
  for (const part of parts) {
    if (typeof value === 'object' && value !== null) {
      value = value[part];
    } else {
      throw new Error(`Invalid path ${path} in ${errorLabel}`);
    }
  }
  return value;
}

const TEMPLATE_PLACEHOLDER = /\$\{([^}]*)\}/g;

const TEMPLATE_NAMESPACES = ['inputData', 'initData', 'state', 'requestContext', 'stepResults'] as const;
type TemplateScope = (typeof TEMPLATE_NAMESPACES)[number];

/** Common error-message prefix so every template diagnostic points at the exact placeholder. */
function describeBadPlaceholder(template: string, idx: number, rawExpr: string): string {
  return `Template placeholder #${idx} (\${${rawExpr}}) in '${template}'`;
}

/** Split a placeholder body `scope.path.with.dots` into its leading scope and the dotted remainder. */
function parseTemplatePlaceholder(rawExpr: string): { scope: string; rest: string } {
  const dot = rawExpr.indexOf('.');
  return {
    scope: dot === -1 ? rawExpr : rawExpr.slice(0, dot),
    rest: dot === -1 ? '' : rawExpr.slice(dot + 1),
  };
}

/**
 * Validates a `{ template }` source's syntax at workflow-definition time.
 * Throws if any placeholder is empty, whitespace-padded, references an unknown
 * namespace, or is a malformed `stepResults.<stepId>` / `stepResults.<stepId>.<path>` shape.
 *
 * Run-time concerns (does the step actually exist, does the path resolve, is
 * the value a primitive) stay in {@link resolveTemplate}.
 */
export function validateTemplate(template: string): void {
  let idx = 0;
  for (const match of template.matchAll(TEMPLATE_PLACEHOLDER)) {
    idx++;
    const rawExpr = match[1] ?? '';
    if (rawExpr.length === 0 || rawExpr !== rawExpr.trim()) {
      throw new Error(
        `${describeBadPlaceholder(template, idx, rawExpr)} has empty or whitespace-padded contents. ` +
          `Use \${<scope>.<path>} with no surrounding whitespace.`,
      );
    }
    const { scope, rest } = parseTemplatePlaceholder(rawExpr);
    if (scope === 'stepResults') {
      const innerDot = rest.indexOf('.');
      const stepId = innerDot === -1 ? rest : rest.slice(0, innerDot);
      if (!stepId) {
        throw new Error(
          `${describeBadPlaceholder(template, idx, rawExpr)} must be of the form \${stepResults.<stepId>} or \${stepResults.<stepId>.<path>}.`,
        );
      }
      continue;
    }
    if (scope === 'requestContext') {
      if (!rest) {
        throw new Error(
          `${describeBadPlaceholder(template, idx, rawExpr)} requires a request-context key — use \${requestContext.<key>}.`,
        );
      }
      continue;
    }
    if ((TEMPLATE_NAMESPACES as readonly string[]).includes(scope)) continue;
    throw new Error(
      `${describeBadPlaceholder(template, idx, rawExpr)} references unknown namespace "${scope}". ` +
        `Use one of: ${TEMPLATE_NAMESPACES.join(', ')}.`,
    );
  }
}

/**
 * Coerces a resolved placeholder value to a string. Primitives are stringified
 * the normal way; objects and arrays are JSON-encoded so downstream agents can
 * consume complex step outputs (e.g. `foreach(agent)` returns `{ text }[]`)
 * directly in a template. `null`/`undefined` render as empty. If JSON encoding
 * fails (circular references, BigInt, etc.), throws with a hint pointing at
 * the offending placeholder.
 */
function stringifyTemplateValue(v: unknown, template: string, idx: number, rawExpr: string): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch (err) {
      throw new Error(
        `${describeBadPlaceholder(template, idx, rawExpr)} resolved to a value that could not be JSON-stringified ` +
          `(${(err as Error).message}). Drill into a primitive path (e.g. \${${rawExpr}.someField}) or reshape the value in a preceding step.`,
      );
    }
  }
  return String(v);
}

/**
 * Resolves `${<scope>.<path>}` placeholders against the implicit namespaces
 * available in a step's execute context. See the `.map()` overload signature
 * for the full list of accepted scopes (`inputData`, `initData`, `state`,
 * `requestContext`, `stepResults.<stepId>`).
 */
export function resolveTemplate(template: string, ctx: any): string {
  let idx = 0;
  return template.replace(TEMPLATE_PLACEHOLDER, (_match, rawExpr: string) => {
    idx++;
    return resolveTemplatePlaceholder(rawExpr, template, idx, ctx);
  });
}

function resolveTemplatePlaceholder(rawExpr: string, template: string, idx: number, ctx: any): string {
  // validateTemplate(template) is called at definition time so we know the
  // raw expr is well-formed (non-empty, no surrounding whitespace, known
  // scope). Runtime only cares about path-resolution + value coercion.
  const { scope, rest } = parseTemplatePlaceholder(rawExpr);
  const label = describeBadPlaceholder(template, idx, rawExpr);
  switch (scope as TemplateScope) {
    case 'inputData':
      return stringifyTemplateValue(traverseMappingPath(ctx.inputData, rest, label), template, idx, rawExpr);
    case 'initData':
      return stringifyTemplateValue(traverseMappingPath(ctx.getInitData(), rest, label), template, idx, rawExpr);
    case 'state':
      return stringifyTemplateValue(traverseMappingPath(ctx.state, rest, label), template, idx, rawExpr);
    case 'requestContext':
      return stringifyTemplateValue(ctx.requestContext.get(rest), template, idx, rawExpr);
    case 'stepResults': {
      const innerDot = rest.indexOf('.');
      const stepId = innerDot === -1 ? rest : rest.slice(0, innerDot);
      const subPath = innerDot === -1 ? '' : rest.slice(innerDot + 1);
      const stepResult = ctx.getStepResult(stepId);
      if (stepResult === null) {
        throw new Error(
          `${label} references stepResults.${stepId} but step "${stepId}" has no successful output ` +
            `(not run yet, not registered, or failed).`,
        );
      }
      return stringifyTemplateValue(traverseMappingPath(stepResult, subPath, label), template, idx, rawExpr);
    }
    default:
      // validateTemplate guarantees this branch is unreachable for well-formed
      // workflows; this is a safety net for templates that bypassed validation
      // (e.g. constructed programmatically and pushed into stepFlow).
      throw new Error(
        `${label} references unknown namespace "${scope}". Use one of: ${TEMPLATE_NAMESPACES.join(', ')}.`,
      );
  }
}
